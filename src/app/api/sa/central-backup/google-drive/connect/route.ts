import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getJwtSecret } from "@/lib/jwt-secret";
import { requireRole } from "@/lib/rbac";
import { centralDriveOAuthUrl } from "@/lib/central-drive-backups";
import {
  secretHash,
  verifyBackupAdministrator,
} from "@/lib/central-backup-config";
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
    if (!parsed.ok || typeof parsed.data?.currentPassword !== "string")
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 },
      );
    let phase: "password" | "configuration" | "state" = "password";
    try {
      await verifyBackupAdministrator(
        session.userId,
        parsed.data.currentPassword,
      );
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
      return NextResponse.json(
        { authorizationUrl },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (phase === "password" && error instanceof Error &&
        ["Current password is required", "Current password is incorrect"].includes(error.message)) {
        return NextResponse.json(
          { error: "Enter the current password you use to sign in to Super Admin, then connect Google Drive." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      // Do not log passwords, OAuth state, secrets, connection URLs or raw SQL errors.
      console.warn("Google Drive connection could not start", { phase });
      return NextResponse.json(
        {
          error: phase === "configuration"
            ? "Google Drive OAuth is not configured correctly on this server. Check the OAuth client and callback settings."
            : phase === "password"
              ? "Could not verify your current password. Please try again."
              : "Could not save the Google Drive connection request. Please try again.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
  { permission: "platform.security" },
);
