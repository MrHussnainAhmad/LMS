import { checkExpoPushReceipts } from "@/lib/notifications";
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

async function runOnce() {
  try {
    const result = await checkExpoPushReceipts();
    console.info("Push receipt worker completed", result);
  } catch (error) {
    console.error("Push receipt worker failed", error);
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
