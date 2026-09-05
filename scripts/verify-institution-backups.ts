import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { pool } from '@/db';

async function main() {
  const region = process.env.B2_REGION?.trim();
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const secretAccessKey = process.env.B2_APPLICATION_KEY?.trim();
  if (!region || !bucket || !accessKeyId || !secretAccessKey) throw new Error('B2 backup configuration is incomplete');

  const migrations = ['0041_institution_backups.sql', '0042_institution_backup_retries.sql'];
  for (const name of migrations) {
    const migrationSql = await readFile(`drizzle/${name}`, 'utf8');
    const expected = createHash('sha256').update(migrationSql).digest('hex');
    const ledger = await pool.query<{ sha256: string }>('SELECT sha256 FROM nisaab360_supplemental_migrations WHERE name = $1', [name]);
    if (ledger.rows[0]?.sha256 !== expected) throw new Error(`Migration ledger mismatch: ${name}`);
  }

  const client = new S3Client({
    region, endpoint: `https://s3.${region}.backblazeb2.com`, forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  const completed = await pool.query<{
    id: number; object_key: string; file_size: string; sha256: string;
  }>(`SELECT id, object_key, file_size::text, sha256 FROM institution_backups
      WHERE status = 'COMPLETED' ORDER BY id`);
  for (const backup of completed.rows) {
    const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: backup.object_key }));
    if (Number(remote.ContentLength) !== Number(backup.file_size) || remote.Metadata?.sha256 !== backup.sha256) {
      throw new Error(`Remote metadata mismatch for institution backup ${backup.id}`);
    }
  }
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'postgres-backups/', MaxKeys: 1000 }));
  process.stdout.write(`Verified ${completed.rowCount ?? completed.rows.length} institution backups; ${listed.KeyCount ?? 0} backup objects currently visible in B2.\n`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});

