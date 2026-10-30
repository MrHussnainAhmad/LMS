import { pool } from "@/db";
import { queueDatabaseBackup } from "./central-backup-config";

export async function startManualDatabaseBackup(actor: number) {
  const job = await queueDatabaseBackup("MANUAL", actor);
  if (job.status === "RUNNING" || job.status === "COMPLETED") return job;
  let status = 503;
  try {
    const response = await fetch("http://postgres-backup:8788/start", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
      body: JSON.stringify({ runId: job.run_id }), signal: AbortSignal.timeout(15_000),
    });
    status = response.status;
    const result = await response.json();
    if (!response.ok || result.started !== true || result.runId !== job.run_id) throw Error("Backup startup was not acknowledged");
  } catch {
    // A lost acknowledgement must not cancel a backup that actually started.
    const { rows: [current] } = await pool.query("SELECT run_id,status FROM central_backup_jobs WHERE run_id=$1", [job.run_id]);
    if (current && ["RUNNING", "COMPLETED"].includes(current.status)) return current;
    await pool.query("UPDATE central_backup_jobs SET status='FAILED',completed_at=now(),error='Backup service could not start this request.' WHERE run_id=$1 AND status='PENDING'", [job.run_id]);
    throw Error(status === 409 ? "A backup is already running. Try again after it finishes." : "The backup service could not start. No backup was created. Please try again or contact your server administrator.");
  }
  return { ...job, status: "RUNNING" };
}
