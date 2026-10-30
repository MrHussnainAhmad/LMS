import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getJwtSecret } from "@/lib/jwt-secret";
import { requireRole } from "@/lib/rbac";
import { centralDriveOAuthUrl } from "@/lib/central-drive-backups";
import {
  secretHash,
} from "@/lib/central-backup-config";
import { confirmBackupAdministrator, withBackupConfirmation, backupConfirmationError } from "@/lib/backup-confirmation";
import { readJsonBody, AUTH_MAX_BODY_BYTES } from "@/lib/http";
import { withRateLimit } from "@/lib/rate-limit";
export const POST = requireRole(
  ["SUPER_ADMIN"],
  async (req, { session }) => {
    if (
      !(await withRateLimit(req, "auth", "backup-drive:" + session.userId))
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
    let phase: "password" | "configuration" | "state" = "password";
    let confirmation: Awaited<ReturnType<typeof confirmBackupAdministrator>> | undefined;
    try {
      confirmation = await confirmBackupAdministrator(req, session, parsed.data?.currentPassword as string | undefined);
      phase = "configuration";
      const nonce = randomBytes(32).toString("base64url");
      const state = await new SignJWT({
        purpose: "central-google-drive-setup",
        nonce,
        device: session.planDeviceSessionId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(session.userId))
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(getJwtSecret());
      const authorizationUrl = centralDriveOAuthUrl(state);
      phase = "state";
      await pool.query(
        `INSERT INTO central_backup_settings(id,oauth_state_hash,oauth_state_expires_at) VALUES(1,$1,now()+interval '15 minutes')
   ON CONFLICT(id) DO UPDATE SET oauth_state_hash=$1,oauth_state_expires_at=now()+interval '15 minutes'`,
        [secretHash(nonce)],
      );
      return withBackupConfirmation(NextResponse.json(
        { authorizationUrl, confirmationExpiresAt: confirmation.expiresAt },
        { headers: { "Cache-Control": "no-store" } },
      ), confirmation);
    } catch (error) {
      if (phase === "password") return backupConfirmationError(error, confirmation, "Could not verify your current password. Please try again.", 503);
      // Do not log passwords, OAuth state, secrets, connection URLs or raw SQL errors.
      console.warn("Google Drive connection could not start", { phase });
      return backupConfirmationError(error, confirmation, phase === "configuration"
            ? "Google Drive OAuth is not configured correctly on this server. Check the OAuth client and callback settings."
            : "Could not save the Google Drive connection request. Please try again.", 503);
    }
  },
  { permission: "platform.security" },
);
