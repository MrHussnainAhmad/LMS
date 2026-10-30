import { readBoundedJson } from '@/lib/http';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createRecoveryPackage } from '@/lib/database-recovery-package';
import { getBackupSettings, backupReady, encryptStreamingCredentials } from '@/lib/central-backup-config';
import { deliverBackupPassword, retainLatestDatabaseBackups } from '@/lib/central-backup-delivery';
import { createReadStream } from 'node:fs';
import { lstat, realpath, unlink } from 'node:fs/promises';
import { timingSafeEqual } from '@/lib/auth';
import { decryptStreamingCredentials } from '@/lib/streaming-credentials';
import { BackupBusyError, withCentralBackupLock } from '@/lib/central-backup-lock';
import { backupFileSha256, encryptCentralDump, generateBackupPassword } from '@/lib/central-backup-crypto';
import { uploadCentralBackupFile, verifyCentralDriveFile, reserveCentralDriveFileId,
  centralDriveFolderId } from '@/lib/central-drive-backups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
type BackupRow = {
  status: string; drive_file_id: string | null; b2_status: string | null;
  source_sha256: string | null; source_size_bytes: string | null;
  sha256: string | null; file_size_bytes: string | null; file_name: string; password_encrypted:string|null; recovery_email:string|null; drive_folder_id:string|null; password_sent_at:Date|null;
};

function errorCode(error: unknown): string {
  const candidate = error as { code?: unknown; status?: unknown; name?: string; cause?: { code?: unknown } } | null;
  const code = candidate?.cause?.code ?? candidate?.code;
  if (candidate?.name === 'AbortError' || candidate?.name === 'TimeoutError') return 'ABORTED';
  if (typeof candidate?.status === 'number' && candidate.status >= 400 && candidate.status <= 599) return `HTTP_${candidate.status}`;
  return typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : 'BACKUP_FAILED';
}

async function tryB2Upload(filePath: string, fileName: string, fileSize: number, signal: AbortSignal) {
  const region = process.env.B2_REGION?.trim(), keyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const key = process.env.B2_APPLICATION_KEY?.trim(), bucket = process.env.B2_BUCKET_NAME?.trim();
  if (!region || !keyId || !key || !bucket) return 'SKIPPED';
  const client = new S3Client({ region, endpoint: `https://s3.${region}.backblazeb2.com`, forcePathStyle: true,
    credentials: { accessKeyId: keyId, secretAccessKey: key } });
  const stream = createReadStream(filePath);
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: `central-database-backups/${fileName}`,
      Body: stream, ContentLength: fileSize, ContentType: 'application/octet-stream' }), { abortSignal: signal });
    return 'UPLOADED';
  } catch {
    console.error('[central-backup] Secondary encrypted B2 upload failed');
    return 'FAILED';
  } finally { stream.destroy(); client.destroy(); }
}

// Metadata describes the validated RAW dump. The persisted size/hash/filename
// describe the ENCRYPTED remote artifact; source_* binds retries to the raw dump.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !(timingSafeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
    || timingSafeEqual(req.headers.get('x-cron-secret') ?? '', secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await readBoundedJson(req); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { runId, fileName, filePath, fileSizeBytes, sha256 } = body;
  if (typeof runId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(runId)
    || typeof fileName !== 'string' || !/^database-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(?:-[0-9a-f]{16})?\.dump$/.test(fileName)
    || typeof filePath !== 'string' || !/^\/backups\/backup-[A-Za-z0-9_-]+\.dump$/.test(filePath)
    || typeof fileSizeBytes !== 'number' || !Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0
    || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
  }
  const encryptedPath = `${filePath}.enc`, packagePath = `${filePath}.package`, encryptedFileName = fileName.replace(/\.dump$/, ".n360backup");
  try {
    return await withCentralBackupLock(async (client, signal) => {
      let tracked = false, outputOwned = false, rawOwned = false, completed = false;
      let stage = 'database lookup';
      try {
        // An active uploader holds this same global lock. Old UPLOADING rows
        // therefore represent interrupted workers, not another live replica.
        await client.query(`UPDATE central_database_backups SET status='FAILED',
          error='Backup worker was interrupted before completion',completed_at=now()
          WHERE status='UPLOADING' AND started_at < now() - interval '2 hours' AND run_id <> $1`, [runId]);
        const { rows: [existing] } = await client.query<BackupRow>(
          'SELECT * FROM central_database_backups WHERE run_id=$1', [runId]);
        if (existing?.source_sha256 && (existing.source_sha256 !== sha256 || Number(existing.source_size_bytes) !== fileSizeBytes
          || existing.file_name !== encryptedFileName)) throw new RequestError('Run ID already belongs to a different backup', 409);
        if (existing?.status === 'COMPLETED') return NextResponse.json({ success: true, runId,
          driveFileId: existing.drive_file_id, b2Status: existing.b2_status, idempotent: true });
        tracked = existing !== undefined;

        const folderId = existing?.drive_folder_id || await centralDriveFolderId();
        let driveFileId = existing?.drive_file_id;
        let encryptedSize = existing?.file_size_bytes ? Number(existing.file_size_bytes) : 0;
        let encryptedSha256 = existing?.sha256;
        let remoteVerified = false;
        // Recover a crash/timeout after upload but before the COMPLETED update.
        if (driveFileId && encryptedSha256 && existing?.file_name.endsWith('.n360backup')) {
          stage = 'remote retry verification';
          try {
            remoteVerified = await verifyCentralDriveFile({ driveFileId, expectedSize: encryptedSize,
              expectedSha256: encryptedSha256, folderId, signal });
            if (!remoteVerified) throw new Error('Remote backup integrity mismatch');
          } catch (error) {
            if ((error as { status?: number }).status !== 404) throw error;
          }
        }
        let b2Status = existing?.b2_status ?? 'SKIPPED';
        if (!remoteVerified) {
          stage = 'source validation';
          const reuse = Boolean(existing?.source_sha256 && driveFileId && encryptedSha256 && existing.file_name.endsWith('.n360backup'));
          if (reuse) {
            // Reuse identical ciphertext while a prior timed-out upload may still
            // commit. A new salt would change the expected digest for that ID.
            const info = await lstat(encryptedPath).catch(() => { throw new Error('Encrypted retry artifact is unavailable'); });
            if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || await realpath(encryptedPath) !== encryptedPath
              || info.size !== encryptedSize || await backupFileSha256(encryptedPath, signal) !== encryptedSha256) {
              throw new Error('Encrypted retry artifact does not match the reserved upload');
            }
            outputOwned = true;
          } else {
            const info = await lstat(filePath).catch(() => { throw new RequestError('Backup source not found'); });
            if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (await realpath(filePath)) !== filePath
              || info.size !== fileSizeBytes) throw new RequestError('Invalid backup source');
            if (await backupFileSha256(filePath, signal) !== sha256) throw new RequestError('Backup source checksum mismatch');
            rawOwned = true;
          }

          await client.query(`INSERT INTO central_database_backups(run_id,file_name,source_size_bytes,source_sha256,status)
            VALUES($1,$2,$3,$4,'UPLOADING') ON CONFLICT(run_id) DO UPDATE
            SET status='UPLOADING',error=NULL,completed_at=NULL,source_size_bytes=$3,source_sha256=$4,started_at=now()`,
          [runId, encryptedFileName, fileSizeBytes, sha256]);
          tracked = true;
          if (!reuse) {
            stage = 'password configuration';
            const settings = await getBackupSettings(client);
            if (!backupReady(settings)) throw new Error('Connect Drive, verify email and enable database backups');
            const password = existing?.password_encrypted ? decryptStreamingCredentials(existing.password_encrypted)?.password : generateBackupPassword();
            if (!password) throw new Error('Backup recovery key is unavailable');
            await client.query('UPDATE central_database_backups SET password_encrypted=$2,recovery_email=$3,drive_folder_id=$4,package_version=1 WHERE run_id=$1',
              [runId,encryptStreamingCredentials({password}),existing?.recovery_email || settings!.recovery_email,folderId]);
            const stale = await lstat(encryptedPath).catch(() => null);
            if (stale) {
              if (!stale.isFile() || stale.isSymbolicLink() || stale.nlink !== 1) throw new RequestError('Invalid encrypted output');
              await unlink(encryptedPath);
            }
            stage = 'encryption';
            await unlink(packagePath).catch(()=>undefined);
            try {await createRecoveryPackage(filePath, packagePath, runId, signal);
              await encryptCentralDump(packagePath, encryptedPath, password, signal);
            } finally {await unlink(packagePath).catch(()=>undefined);}
            outputOwned = true;
            encryptedSize = (await lstat(encryptedPath)).size;
            encryptedSha256 = await backupFileSha256(encryptedPath, signal);
          }
          stage = 'remote ID allocation';
          driveFileId ||= await reserveCentralDriveFileId(signal);
          // Persist the reserved ID and encrypted digest BEFORE network upload.
          await client.query('UPDATE central_database_backups SET drive_file_id=$2,file_size_bytes=$3,sha256=$4,file_name=$5 WHERE run_id=$1',
            [runId, driveFileId, encryptedSize, encryptedSha256, encryptedFileName]);
          signal.throwIfAborted();
          stage = 'Drive upload';
          await uploadCentralBackupFile({ filePath: encryptedPath, fileName: encryptedFileName, folderId, driveFileId, signal });
          stage = 'Drive checksum verification';
          if (!await verifyCentralDriveFile({ driveFileId, expectedSize: encryptedSize, expectedSha256: encryptedSha256!, folderId, signal })) {
            throw new Error('Remote backup integrity mismatch');
          }
          b2Status = await tryB2Upload(encryptedPath, encryptedFileName, encryptedSize, signal);
        }
        signal.throwIfAborted();
        stage = 'recovery email delivery';
        await client.query("UPDATE central_database_backups SET drive_verified_at=now(),drive_folder_id=$3,b2_status=$2 WHERE run_id=$1", [runId, b2Status, folderId]);
        await deliverBackupPassword(client,runId,signal);
        completed = true;
        try {
          await retainLatestDatabaseBackups(client,signal);
        } catch { console.error('[central-backup] Retention failed; verified backup remains completed'); }
        console.log(`[central-backup] run ${runId} completed; encrypted upload verified`);
        return NextResponse.json({ success: true, runId, fileName: encryptedFileName, driveFileId, b2Status });
      } catch (error) {
        if (!(error instanceof RequestError)) console.error(`[central-backup] ${stage} failed (${errorCode(error)})`);
        if (tracked) await client.query("UPDATE central_database_backups SET status='FAILED',error=$2,completed_at=now() WHERE run_id=$1 AND status <> 'COMPLETED'",
          [runId, `Backup failed during ${stage} (${errorCode(error)}). Check backup service health and configuration.`]).catch(() => {
          console.error('[central-backup] Could not persist failure status');
        });
        throw error;
      } finally {
        if (completed && outputOwned) await unlink(encryptedPath).catch(() => console.error('[central-backup] Encrypted temporary file cleanup failed'));
        // Failed raw sources remain only for the worker's bounded retry window.
        // The worker removes them on every exit and reaps crash leftovers.
        if (completed && rawOwned) await unlink(filePath).catch(() => undefined);
      }
    });
  } catch (error) {
    if (error instanceof BackupBusyError) return NextResponse.json({ error: 'A central backup is already running' }, { status: 409, headers: { 'Retry-After': '60' } });
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`[central-backup] Backup request failed (${errorCode(error)})`);
    return NextResponse.json({ error: 'Central backup failed. Check backup configuration and service health.' }, { status: 500 });
  }
}
