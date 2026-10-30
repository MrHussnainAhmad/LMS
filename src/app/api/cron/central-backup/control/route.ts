import { NextResponse } from "next/server";
import { pool } from "@/db";
import {
  secretHash,
  equalHash,
  getBackupSettings,
  backupReady,
  queueDatabaseBackup,
} from "@/lib/central-backup-config";
import { retryBackupEmailDelivery } from "@/lib/central-backup-delivery";
import { readJsonBody } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !equalHash(
      secretHash(req.headers.get("authorization") || ""),
      secretHash("Bearer " + secret),
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody<{
    action?: string;
    runId?: string;
    success?: boolean;
  }>(req, 2048);
  if (!parsed.ok)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const { action, runId, success } = parsed.data;
    if (action === "retry-email") {
      if ((await getBackupSettings())?.restore_review_required)
        return NextResponse.json({ success: true, delivered: 0, paused: true });
      let delivered = 0;
      try {
        delivered = await retryBackupEmailDelivery();
      } catch {}
      const {
        rows: [latest],
      } = await pool.query(
        "SELECT extract(epoch from max(created_at))::bigint AS epoch FROM central_database_backups WHERE status='COMPLETED' AND password_sent_at IS NOT NULL AND deleted_at IS NULL",
      );
      return NextResponse.json({
        success: true,
        delivered,
        latestSuccessEpoch: Number(latest?.epoch) || 0,
      });
    }
    if (action === "finish") {
      if (typeof runId !== "string" || !/^[-A-Za-z0-9_]{1,128}$/.test(runId))
        return NextResponse.json({ error: "Invalid run" }, { status: 400 });
      await pool.query(
        `UPDATE central_backup_jobs SET status=CASE WHEN $2 THEN 'COMPLETED' ELSE 'FAILED' END,completed_at=now(),error=CASE WHEN $2 THEN NULL ELSE 'Backup did not finish; check backup history and delivery status.' END WHERE run_id=$1 AND status='RUNNING'`,
        [runId, success === true],
      );
      return NextResponse.json({ success: true });
    }
    const settings = await getBackupSettings();
    if (!backupReady(settings))
      return NextResponse.json({ ready: false, job: null });
    if (action === "nightly") {
      // The container schedules 21:00 UTC = 02:00 Asia/Karachi. Reject accidental daytime invocations.
      const local = new Date(Date.now() + 5 * 3600_000);
      if (local.getUTCHours() !== 2)
        return NextResponse.json(
          { error: "Outside scheduled backup hour" },
          { status: 409 },
        );
      await queueDatabaseBackup("NIGHTLY");
      return NextResponse.json({ success: true });
    }
    if (action !== "claim")
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    await pool.query(
      "UPDATE central_backup_jobs SET status='FAILED',completed_at=now(),error='Backup worker interrupted.' WHERE status='RUNNING' AND started_at<now()-interval '2 hours'",
    );
    const {
      rows: [job],
    } = await pool.query(
      `UPDATE central_backup_jobs SET status='RUNNING',started_at=now(),attempts=attempts+1 WHERE run_id=(SELECT run_id FROM central_backup_jobs WHERE status='PENDING' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING run_id,created_at`,
    );
    if (!job) return NextResponse.json({ ready: true, job: null });
    const timestamp = new Date(job.created_at)
      .toISOString()
      .slice(0, 16)
      .replace("T", "-")
      .replace(":", "-");
    return NextResponse.json({
      ready: true,
      job: {
        runId: job.run_id,
        fileName: `database-${timestamp}-${secretHash(job.run_id).slice(0, 16)}.dump`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Backup control is temporarily unavailable" },
      { status: 503 },
    );
  }
}
