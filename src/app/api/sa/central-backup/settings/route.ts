import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/db";
import { requireRole } from "@/lib/rbac";
import { readJsonBody, AUTH_MAX_BODY_BYTES } from "@/lib/http";
import { withRateLimit } from "@/lib/rate-limit";
import {
  getBackupSettings,
  backupReady,
  beginRecoveryEmail,
  confirmRecoveryEmail,
  verifyBackupAdministrator,
  nextNightlyBackup,
} from "@/lib/central-backup-config";
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("finish-recovery-review"),
      currentPassword: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      action: z.literal("send-code"),
      email: z.email().max(254),
      currentPassword: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      action: z.literal("verify-code"),
      code: z.string().regex(/^[a-fA-F0-9]{8}$/),
      currentPassword: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      action: z.literal("enable"),
      enabled: z.boolean(),
      currentPassword: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      action: z.literal("disconnect-drive"),
      currentPassword: z.string().min(1).max(1024),
    })
    .strict(),
]);
export const GET = requireRole(
  ["SUPER_ADMIN"],
  async () => {
    const s = await getBackupSettings();
    return NextResponse.json(
      {
        enabled: s?.enabled ?? false,
        recoveryReviewRequired: s?.restore_review_required ?? false,
        ready: backupReady(s),
        driveConnected: Boolean(
          s?.drive_credentials_encrypted && s.drive_folder_id,
        ),
        driveEmail: s?.drive_email ?? null,
        driveFolderId: s?.drive_folder_id ?? null,
        recoveryEmail: s?.recovery_email ?? null,
        recoveryEmailVerified: Boolean(s?.recovery_email_verified_at),
        pendingEmail: s?.pending_recovery_email ?? null,
        schedule: "02:00",
        timeZone: "Asia/Karachi",
        nextBackupAt: s?.enabled ? nextNightlyBackup() : null,
        retention: 2,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { permission: "platform.security" },
);
export const PUT = requireRole(
  ["SUPER_ADMIN"],
  async (req, { session }) => {
    if (
      !(await withRateLimit(req, "auth", "backup-settings:" + session.userId))
        .success
    )
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429 },
      );
    const body = await readJsonBody(req, AUTH_MAX_BODY_BYTES);
    if (!body.ok)
      return NextResponse.json({ error: body.error }, { status: body.status });
    const parsed = input.safeParse(body.data);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid recovery settings" },
        { status: 400 },
      );
    try {
      const value = parsed.data;
      await verifyBackupAdministrator(session.userId, value.currentPassword);
      if (value.action === "send-code")
        await beginRecoveryEmail(
          value.email.trim().toLowerCase(),
          session.userId,
        );
      if (value.action === "verify-code")
        await confirmRecoveryEmail(value.code);
      if (value.action === "enable") {
        const s = await getBackupSettings();
        if (value.enabled && !backupReady(s ? { ...s, enabled: true } : null))
          throw Error("Connect Drive and verify the recovery email first");
        await pool.query(
          "UPDATE central_backup_settings SET enabled=$1,updated_at=now() WHERE id=1",
          [value.enabled],
        );
      }
      if (value.action === "finish-recovery-review")
        await pool.query(
          "UPDATE central_backup_settings SET restore_review_required=false,updated_at=now() WHERE id=1",
        );
      if (value.action === "disconnect-drive")
        await pool.query(
          "UPDATE central_backup_settings SET enabled=false,drive_credentials_encrypted=NULL,drive_email=NULL,drive_folder_id=NULL,updated_at=now() WHERE id=1",
        );
      return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not update settings. Check your current password, verification code and mail configuration.",
        },
        { status: 400 },
      );
    }
  },
  { permission: "platform.security" },
);
