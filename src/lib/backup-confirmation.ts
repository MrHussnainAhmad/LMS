import { SignJWT, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import type { JWTPayload } from "./auth-types";
import { getJwtSecret } from "./jwt-secret";
import { verifyBackupAdministrator } from "./central-backup-config";

const COOKIE = "nisaab360_backup_confirmation";
const AUDIENCE = "central-backup-actions";
const LIFETIME_SECONDS = 15 * 60;
type Confirmation = { expiresAt: string; token?: string };

export class BackupConfirmationRequired extends Error {
  constructor() {
    super("Confirm your Super Admin password once to unlock backup controls for 15 minutes.");
  }
}

// Call only inside the ordinary fresh-session/platform.security guards. This
// proof is bound to that session; it never grants access after logout/revocation.
export async function backupConfirmationExpiresAt(req: NextRequest, session: JWTPayload): Promise<string | null> {
  if (session.role !== "SUPER_ADMIN" || !session.planDeviceSessionId) return null;
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"], audience: AUDIENCE, issuer: "nisaab360",
      maxTokenAge: LIFETIME_SECONDS,
    });
    if (payload.sub !== String(session.userId) || payload.device !== session.planDeviceSessionId || typeof payload.exp !== "number") return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

export async function confirmBackupAdministrator(req: NextRequest, session: JWTPayload, password?: string): Promise<Confirmation> {
  if (session.role !== "SUPER_ADMIN" || !session.planDeviceSessionId) throw new BackupConfirmationRequired();
  if (!password) {
    const expiresAt = await backupConfirmationExpiresAt(req, session);
    if (!expiresAt) throw new BackupConfirmationRequired();
    return { expiresAt };
  }
  await verifyBackupAdministrator(session.userId, password);
  const expires = Math.floor(Date.now() / 1000) + LIFETIME_SECONDS;
  const token = await new SignJWT({ device: session.planDeviceSessionId })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(session.userId))
    .setAudience(AUDIENCE).setIssuer("nisaab360").setIssuedAt().setExpirationTime(expires)
    .sign(getJwtSecret());
  return { expiresAt: new Date(expires * 1000).toISOString(), token };
}

export function withBackupConfirmation(response: NextResponse, confirmation?: Confirmation) {
  response.headers.set("Cache-Control", "no-store");
  if (confirmation?.token) response.cookies.set(COOKIE, confirmation.token, {
    httpOnly: true, secure: process.env.DEPLOYMENT_ENV === "production",
    sameSite: "lax", path: "/api/sa/central-backup", expires: new Date(confirmation.expiresAt),
  });
  return response;
}

export function backupConfirmationError(error: unknown, confirmation: Confirmation | undefined, fallback: string, status = 400) {
  const required = error instanceof BackupConfirmationRequired;
  const incorrect = error instanceof Error && ["Current password is required", "Current password is incorrect"].includes(error.message);
  return withBackupConfirmation(NextResponse.json({
    error: required ? error.message : incorrect ? "Your current Super Admin password is incorrect. Enter it again and retry." : fallback,
    ...(required ? { code: "BACKUP_CONFIRMATION_REQUIRED" } : {}),
    ...(confirmation ? { confirmationExpiresAt: confirmation.expiresAt } : {}),
  }, { status: required ? 403 : incorrect ? 400 : status }), confirmation);
}
