import { withCentralBackupLock } from "./central-backup-lock";
import { decryptStreamingCredentials } from "./streaming-credentials";
import { sendRecoveryEmail } from "./central-backup-mail";
import {
  deleteDriveFile,
  verifyCentralDriveFile,
} from "./central-drive-backups";
import type { PoolClient } from "pg";
export async function deliverBackupPassword(
  client: PoolClient,
  runId: string,
  signal?: AbortSignal,
) {
  const {
    rows: [row],
  } = await client.query(
    "SELECT * FROM central_database_backups WHERE run_id=$1",
    [runId],
  );
  if (!row || !row.drive_verified_at || row.deleted_at)
    throw Error("Verified backup required before email");
  if (row.password_sent_at) return;
  const password = decryptStreamingCredentials(
    row.password_encrypted,
  )?.password;
  if (!password || !row.recovery_email)
    throw Error("Recovery delivery material unavailable");
  signal?.throwIfAborted();
  await client.query(
    "UPDATE central_database_backups SET delivery_attempts=delivery_attempts+1,next_delivery_at=now()+least(60,power(2,least(delivery_attempts+1,6))) * interval '1 minute' WHERE run_id=$1",
    [runId],
  );
  await sendRecoveryEmail(
    row.recovery_email,
    `Nisaab360 database backup password - ${runId}`,
    `Backup: ${row.file_name}
Backup ID: ${runId}
Created: ${new Date(row.created_at).toISOString()}
Encrypted file SHA-256: ${row.sha256}

Recovery password: ${password}

Keep this message privately. It unlocks this backup only. The encrypted file is in your connected Google Drive. Never forward this password or share it with support.`,
  );
  // SMTP acceptance is recorded; recipient delivery/bounces must still be monitored.
  await client.query(
    "UPDATE central_database_backups SET password_sent_at=now(),status='COMPLETED',error=NULL,completed_at=now() WHERE run_id=$1",
    [runId],
  );
  await client.query(
    "UPDATE central_backup_jobs SET status='COMPLETED',completed_at=now(),error=NULL WHERE run_id=$1",
    [runId],
  );
}
export async function retainLatestDatabaseBackups(
  client: PoolClient,
  signal?: AbortSignal,
) {
  const { rows } =
    await client.query(`SELECT run_id,drive_file_id FROM central_database_backups WHERE package_version=1 AND status='COMPLETED'
 AND password_sent_at IS NOT NULL AND deleted_at IS NULL ORDER BY created_at DESC,id DESC OFFSET 2`);
  for (const row of rows) {
    signal?.throwIfAborted();
    await deleteDriveFile(row.drive_file_id, signal);
    await client.query(
      "UPDATE central_database_backups SET deleted_at=now(),password_encrypted=NULL WHERE run_id=$1",
      [row.run_id],
    );
  }
}
export async function retryBackupEmailDelivery() {
  return withCentralBackupLock(async (client, signal) => {
    const { rows } =
      await client.query(`SELECT * FROM central_database_backups WHERE package_version=1 AND drive_verified_at IS NOT NULL
   AND password_sent_at IS NULL AND deleted_at IS NULL AND (next_delivery_at IS NULL OR next_delivery_at<=now()) ORDER BY created_at LIMIT 3`);
    let delivered = 0;
    for (const row of rows) {
      try {
        if (
          !(await verifyCentralDriveFile({
            driveFileId: row.drive_file_id,
            expectedSize: Number(row.file_size_bytes),
            expectedSha256: row.sha256,
            folderId: row.drive_folder_id,
            signal,
          }))
        )
          throw Error("Backup is unavailable");
        await deliverBackupPassword(client, row.run_id, signal);
        delivered++;
      } catch {
        await client.query(
          "UPDATE central_database_backups SET status='FAILED',error='Recovery email delivery pending. Automatic retry will continue.' WHERE run_id=$1",
          [row.run_id],
        );
      }
    }
    if (delivered)
      try {
        await retainLatestDatabaseBackups(client, signal);
      } catch {
        console.error("[central-backup] Retention pending");
      }
    return delivered;
  });
}
