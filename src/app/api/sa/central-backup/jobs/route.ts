import { NextResponse } from "next/server";
import { pool } from "@/db";
import { requireRole } from "@/lib/rbac";
import { readJsonBody, AUTH_MAX_BODY_BYTES } from "@/lib/http";
import {
  queueDatabaseBackup,
  verifyBackupAdministrator,
} from "@/lib/central-backup-config";
import { withRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { logAudit } from "@/lib/audit";
export const GET = requireRole(
  ["SUPER_ADMIN"],
  async () => {
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
  { permission: "platform.security" },
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
    if (!parsed.ok || typeof parsed.data?.currentPassword !== "string")
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 },
      );
    try {
      await verifyBackupAdministrator(
        session.userId,
        parsed.data.currentPassword,
      );
      const job = await queueDatabaseBackup("MANUAL", session.userId);
      await logAudit({
        actorId: session.userId,
        actorRole: session.role,
        action: "DATABASE_BACKUP_QUEUED",
        target: job.run_id,
        ip: getClientIp(req),
      });
      return NextResponse.json(
        { job },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not queue backup. Check your password and completed backup setup.",
        },
        { status: 400 },
      );
    }
  },
  { permission: "platform.security" },
);
