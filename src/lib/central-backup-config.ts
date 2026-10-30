import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "@/db";
import {
  decryptStreamingCredentials,
  encryptStreamingCredentials,
} from "./streaming-credentials";
import { verifyPassword } from "./argon2-pool";
import { sendRecoveryEmail } from "./central-backup-mail";
export type QueryStore = Pick<typeof pool, "query">;
export type BackupSettings = {
  enabled: boolean;
  restore_review_required?: boolean;
  drive_credentials_encrypted: string | null;
  drive_email: string | null;
  drive_folder_id: string | null;
  recovery_email: string | null;
  recovery_email_verified_at: Date | null;
  pending_recovery_email: string | null;
  email_verification_hash: string | null;
  email_verification_expires_at: Date | null;
  email_verification_attempts: number;
};
export const secretHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function equalHash(a: string, b: string) {
  return (
    /^[a-f0-9]{64}$/.test(a) &&
    /^[a-f0-9]{64}$/.test(b) &&
    timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  );
}
export async function getBackupSettings(
  store: QueryStore = pool,
): Promise<BackupSettings | null> {
  const { rows } = await store.query(
    "SELECT * FROM central_backup_settings WHERE id=1",
  );
  return rows[0] ?? null;
}
export async function getStoredCentralDriveCredentials() {
  const settings = await getBackupSettings();
  const value = decryptStreamingCredentials(
    settings?.drive_credentials_encrypted,
  );
  if (settings?.drive_credentials_encrypted && !value?.refreshToken)
    throw Error("Stored Drive credentials cannot be decrypted");
  return value?.refreshToken
    ? { refreshToken: value.refreshToken, folderId: settings!.drive_folder_id }
    : null;
}
export function backupReady(settings: BackupSettings | null) {
  return Boolean(
    settings?.enabled &&
    !settings.restore_review_required &&
    settings.drive_credentials_encrypted &&
    settings.drive_folder_id &&
    settings.recovery_email &&
    settings.recovery_email_verified_at,
  );
}
export async function verifyBackupAdministrator(
  userId: number,
  password: string,
) {
  if (!password || password.length > 1024)
    throw Error("Current password is required");
  const {
    rows: [user],
  } = await pool.query(
    "SELECT password_hash FROM super_admins WHERE id=$1 AND is_super_admin=true",
    [userId],
  );
  if (!user || !(await verifyPassword(user.password_hash, password)))
    throw Error("Current password is incorrect");
}
export async function beginRecoveryEmail(email: string, actor: number) {
  const code = randomBytes(4).toString("hex").toUpperCase();
  // Bind verification to the address, not just a reusable code.
  const digest = secretHash(email + ":" + code);
  await pool.query(
    `INSERT INTO central_backup_settings(id,pending_recovery_email,email_verification_hash,email_verification_expires_at,email_verification_attempts,updated_by)
 VALUES(1,$1,$2,now()+interval '15 minutes',0,$3) ON CONFLICT(id) DO UPDATE SET pending_recovery_email=$1,email_verification_hash=$2,
 email_verification_expires_at=now()+interval '15 minutes',email_verification_attempts=0,updated_by=$3,updated_at=now()`,
    [email, digest, actor],
  );
  await sendRecoveryEmail(
    email,
    "Verify your Nisaab360 backup recovery email",
    `Verification code: ${code}\n\nThis code expires in 15 minutes. Future database backup passwords will be sent to this address.\nIf you did not request this, ignore this message.`,
  );
}
export async function confirmRecoveryEmail(code: string) {
  const {
    rows: [s],
  } =
    await pool.query(`UPDATE central_backup_settings SET email_verification_attempts=email_verification_attempts+1
 WHERE id=1 AND email_verification_expires_at>now() AND email_verification_attempts<5 RETURNING *`);
  if (
    !s ||
    !s.pending_recovery_email ||
    !equalHash(
      secretHash(s.pending_recovery_email + ":" + code.trim().toUpperCase()),
      s.email_verification_hash || "",
    )
  )
    throw Error("Invalid or expired verification code");
  const result = await pool.query(
    `UPDATE central_backup_settings SET recovery_email=pending_recovery_email,recovery_email_verified_at=now(),pending_recovery_email=NULL,
 email_verification_hash=NULL,email_verification_expires_at=NULL,updated_at=now() WHERE id=1 AND email_verification_hash=$1`,
    [s.email_verification_hash],
  );
  if (!result.rowCount) throw Error("Verification was already consumed");
}
export function nextNightlyBackup(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600_000);
  let target =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      2,
    ) -
    5 * 3600_000;
  if (target <= now.getTime()) target += 86400_000;
  return new Date(target).toISOString();
}
export async function queueDatabaseBackup(
  kind: "NIGHTLY" | "MANUAL",
  actor?: number,
) {
  const settings = await getBackupSettings();
  if (!backupReady(settings))
    throw Error(
      "Enable backups after connecting Drive and verifying the recovery email",
    );
  const runId =
    kind === "NIGHTLY"
      ? "nightly-" +
        new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
      : "manual-" + Date.now() + "-" + randomBytes(8).toString("hex");
  await pool.query(
    `INSERT INTO central_backup_jobs(run_id,kind,requested_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
    [runId, kind, actor ?? null],
  );
  const {
    rows: [job],
  } = await pool.query(
    "SELECT run_id,status FROM central_backup_jobs WHERE (kind=$2 AND status IN ('PENDING','RUNNING')) OR run_id=$1 ORDER BY created_at DESC LIMIT 1",
    [runId, kind],
  );
  return job ?? { run_id: runId, status: "COMPLETED" };
}
export { encryptStreamingCredentials, decryptStreamingCredentials };
