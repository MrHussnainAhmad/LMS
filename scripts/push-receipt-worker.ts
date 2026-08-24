import { checkExpoPushReceipts, pruneResolvedPushTickets } from "@/lib/notifications";
import { processFeeVoucherSchedules } from "@/lib/fee-voucher-schedule";
import { pruneExpiredRefreshTokens } from "@/lib/token-maintenance";
import { gracefulShutdown } from "@/lib/process-lifecycle";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 10_000;
const intervalFromEnvironment = Number.parseInt(process.env.PUSH_RECEIPT_INTERVAL_MS ?? "", 10);
const intervalMs = Number.isFinite(intervalFromEnvironment) && intervalFromEnvironment >= MIN_INTERVAL_MS
  ? intervalFromEnvironment
  : DEFAULT_INTERVAL_MS;

let stopping = false;
let timer: NodeJS.Timeout | undefined;
let runInFlight: Promise<void> | undefined;
let lastFeeVoucherScheduleHour: number | undefined;
let lastTokenPruneHour: number | undefined;
let lastTicketPruneHour: number | undefined;

/**
 * Run a maintenance task at most once per wall-clock hour.
 *
 * Each task carries its own guard so one failing task neither blocks the others nor
 * makes them re-run every interval: on failure the hour is left unset, so only that
 * task retries on the next tick.
 */
async function runHourly(
  name: string,
  lastHour: number | undefined,
  currentHour: number,
  task: () => Promise<{ deleted: number } | undefined>,
): Promise<number | undefined> {
  if (lastHour === currentHour) return lastHour;
  try {
    const result = await task();
    if (result && result.deleted > 0) console.info(`${name} completed`, result);
    return currentHour;
  } catch (error) {
    console.error(`${name} failed`, error);
    return lastHour;
  }
}

async function runOnce() {
  try {
    const result = await checkExpoPushReceipts();
    console.info("Push receipt worker completed", result);
  } catch (error) {
    console.error("Push receipt worker failed", error);
  }

  const currentHour = Math.floor(Date.now() / 3_600_000);

  lastTokenPruneHour = await runHourly(
    "Refresh token prune",
    lastTokenPruneHour,
    currentHour,
    pruneExpiredRefreshTokens,
  );

  lastTicketPruneHour = await runHourly(
    "Push ticket prune",
    lastTicketPruneHour,
    currentHour,
    pruneResolvedPushTickets,
  );

  if (lastFeeVoucherScheduleHour === currentHour) return;

  try {
    const result = await processFeeVoucherSchedules();
    lastFeeVoucherScheduleHour = currentHour;
    console.info("Fee voucher schedule completed", result);
  } catch (error) {
    // Leave the hour unset so the next worker interval retries safely.
    console.error("Fee voucher schedule failed", error);
  }
}

async function scheduleNextRun() {
  runInFlight = runOnce();
  await runInFlight;
  runInFlight = undefined;
  if (!stopping) {
    timer = setTimeout(() => {
      void scheduleNextRun();
    }, intervalMs);
  }
}

async function stop(signal: string) {
  if (stopping) return;
  console.info(`Push receipt worker received ${signal}; stopping after the current run.`);
  stopping = true;
  if (timer) clearTimeout(timer);
  if (runInFlight) {
    try {
      await runInFlight;
    } catch {
      // already logged in runOnce
    }
  }
  await gracefulShutdown(signal);
  process.exit(0);
}

process.on("SIGTERM", () => { void stop("SIGTERM"); });
process.on("SIGINT", () => { void stop("SIGINT"); });

console.info("Push receipt worker started", { intervalMs });
void scheduleNextRun();
