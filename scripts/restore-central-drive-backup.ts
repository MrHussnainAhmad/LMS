/** Offline recovery preparation only. Never connects to or restores a database.
 * Use the ORIGINAL password set at /sa/backups, not the server credential key.
 * CENTRAL_DATABASE_RESTORE_PASSWORD is supplied privately for this process only.
 * The old CENTRAL_DATABASE_BACKUP_ENCRYPTION_KEY name remains a recovery alias.
 */
import 'dotenv/config';
import { mkdtemp, mkdir, open, rm, stat, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve, join } from 'node:path';
import { backupFileSink, backupFileSha256, decryptCentralDump } from '../src/lib/central-backup-crypto';
import { getCentralAccessToken } from '../src/lib/central-drive-backups';

export async function prepareCentralRestore(fileId: string, destination: string, password: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) throw new Error('Invalid Drive file ID');
  if (password.length < 14 || password.length > 200) throw new Error('Supply the original 14-200 character UI backup password');
  const output = resolve(destination);
  await mkdir(dirname(output), { recursive: true });
  const work = await mkdtemp(join(dirname(output), '.n360-recovery-'));
  const encrypted = join(work, 'download.enc');
  let plaintextOwned = false;
  try {
    const token = await getCentralAccessToken(undefined,true);
    const headers = { Authorization: `Bearer ${token}` };
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    const metadata = await fetch(`${base}?fields=id,name,size,sha256Checksum&supportsAllDrives=true`, { headers, signal: AbortSignal.timeout(60_000) });
    if (!metadata.ok) throw new Error(`Drive metadata request failed (${metadata.status})`);
    const file = await metadata.json() as { id: string; name: string; size: string; sha256Checksum?: string };
    const expectedSize = Number(file.size);
    if (file.id !== fileId || !Number.isSafeInteger(expectedSize) || expectedSize < 52) throw new Error('Invalid encrypted backup metadata');
    const response = await fetch(`${base}?alt=media&supportsAllDrives=true`, { headers, signal: AbortSignal.timeout(45 * 60 * 1000) });
    if (!response.ok || !response.body) throw new Error(`Drive download failed (${response.status})`);
    const sink = await open(encrypted, 'wx', 0o600);
    try { await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), backupFileSink(sink)); }
    finally { await sink.close(); }
    if ((await stat(encrypted)).size !== expectedSize) throw new Error('Downloaded backup size mismatch');
    const checksum = await backupFileSha256(encrypted);
    if (file.sha256Checksum && checksum !== file.sha256Checksum) throw new Error('Downloaded backup checksum mismatch');
    // Exclusive creation never replaces an existing output. Failed authentication
    // removes only the newly created partial plaintext in decryptCentralDump.
    await decryptCentralDump(encrypted, output, password);
    plaintextOwned = true;
    execFileSync('pg_restore', ['--list', output], { stdio: 'ignore' });
    console.log(`[restore] Encrypted checksum: ${checksum}`);
    console.log('[restore] Password authentication and dump catalog verified. No database was modified.');
    return { outputPath: output, encryptedSha256: checksum };
  } catch {
    if (plaintextOwned) await unlink(output).catch(() => undefined);
    throw new Error('Recovery preparation failed. Check the original backup password, unused output path, Drive access and compatible pg_restore.');
  } finally { await rm(work, { recursive: true, force: true }); }
}

async function main() {
  const args = process.argv.slice(2);
  const fileId = args[args.indexOf('--file-id') + 1];
  const output = args[args.indexOf('--output') + 1];
  if (!args.includes('--file-id') || !args.includes('--output') || !fileId || !output) {
    throw new Error('Usage: node --import tsx scripts/restore-central-drive-backup.ts --file-id ID --output /private/recovery.dump');
  }
  const password = process.env.CENTRAL_DATABASE_RESTORE_PASSWORD ?? process.env.CENTRAL_DATABASE_BACKUP_ENCRYPTION_KEY ?? '';
  const result = await prepareCentralRestore(fileId, output, password);
  console.log(`[restore] Verified dump prepared at ${result.outputPath}. Test pg_restore into a NEW isolated database before disaster recovery.`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/restore-central-drive-backup.ts')) {
  main().catch(() => { console.error('[restore] Recovery failed; no database was modified. Check recovery prerequisites.'); process.exitCode = 1; });
}
