import { checkExpoPushReceipts } from "@/lib/notifications";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 10_000;
const intervalFromEnvironment = Number.parseInt(process.env.PUSH_RECEIPT_INTERVAL_MS ?? "", 10);
const intervalMs = Number.isFinite(intervalFromEnvironment) && intervalFromEnvironment >= MIN_INTERVAL_MS
  ? intervalFromEnvironment
  : DEFAULT_INTERVAL_MS;

let stopping = false;
let timer: NodeJS.Timeout | undefined;

async function runOnce() {
  try {
    const result = await checkExpoPushReceipts();
    console.info("Push receipt worker completed", result);
  } catch (error) {
    console.error("Push receipt worker failed", error);
  }
}

async function scheduleNextRun() {
  await runOnce();
  if (!stopping) {
    timer = setTimeout(scheduleNextRun, intervalMs);
  }
}

function stop(signal: string) {
  console.info(`Push receipt worker received ${signal}; stopping after the current run.`);
  stopping = true;
  if (timer) clearTimeout(timer);
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

console.info("Push receipt worker started", { intervalMs });
void scheduleNextRun();
