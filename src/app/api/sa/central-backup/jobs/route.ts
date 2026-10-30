import { NextResponse } from "next/server";
import { pool } from "@/db";
import { requireRole } from "@/lib/rbac";
import { readJsonBody, AUTH_MAX_BODY_BYTES } from "@/lib/http";
import {
  reconcileBackupHistory,
} from "@/lib/central-backup-config";
import { startManualDatabaseBackup } from "@/lib/central-backup-start";
import { confirmBackupAdministrator, withBackupConfirmation, backupConfirmationError } from "@/lib/backup-confirmation";
import { withRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { logAudit } from "@/lib/audit";
export const GET = requireRole(
  ["SUPER_ADMIN"],
  async () => {
    await reconcileBackupHistory();
    const { rows: backups } = await pool.query(
      `SELECT id,run_id,file_name,file_size_bytes,sha256,status,created_at,completed_at,recovery_email,password_sent_at,drive_verified_at,deleted_at,package_version,error FROM central_database_backups
       WHERE id IN (SELECT id FROM central_database_backups ORDER BY created_at DESC,id DESC LIMIT 30)
       OR id IN (SELECT id FROM central_database_backups WHERE status='COMPLETED' AND password_sent_at IS NOT NULL AND deleted_at IS NULL AND package_version=1 ORDER BY created_at DESC,id DESC LIMIT 2)
       ORDER BY created_at DESC,id DESC`,
    );
    const { rows: jobs } = await pool.query(
      "SELECT run_id,kind,status,created_at,error FROM central_backup_jobs ORDER BY created_at DESC LIMIT 10",
    );
    return NextResponse.json(
      { backups, jobs },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { permission: "platform.security", mutatesOnRead: true },
);
export const POST = requireRole(
  ["SUPER_ADMIN"],
  async (req, { session }) => {
    if (
      !(await withRateLimit(req, "auth", "database-backup:" + session.userId))
        .success
    )
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    const parsed = await readJsonBody<{ currentPassword?: unknown }>(
      req,
      AUTH_MAX_BODY_BYTES,
    );
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    if (parsed.data?.currentPassword !== undefined && typeof parsed.data.currentPassword !== "string")
      return NextResponse.json(
        { error: "Invalid password confirmation" },
        { status: 400 },
      );
    let confirmation: Awaited<ReturnType<typeof confirmBackupAdministrator>> | undefined;
    try {
      confirmation = await confirmBackupAdministrator(req, session, parsed.data?.currentPassword as string | undefined);
      const job = await startManualDatabaseBackup(session.userId);
      await logAudit({
        actorId: session.userId,
        actorRole: session.role,
        action: "DATABASE_BACKUP_STARTED",
        target: job.run_id,
        ip: getClientIp(req),
      }).catch(() => console.warn("Backup started, but its audit log write failed."));
      return withBackupConfirmation(NextResponse.json(
        { job, confirmationExpiresAt: confirmation.expiresAt },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      ), confirmation);
    } catch (error) {
      const message = error instanceof Error && ["A backup is already running. Try again after it finishes.", "The backup service could not start. No backup was created. Please try again or contact your server administrator."].includes(error.message) ? error.message : "Could not start backup. Check that Drive, recovery email and nightly backups are configured.";
      return backupConfirmationError(error, confirmation, message, 503);
    }
  },
  { permission: "platform.security" },
);
