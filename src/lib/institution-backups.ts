import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import QueryStream from 'pg-query-stream';
import { db } from '@/db';
import { institutionBackups } from '@/db/schema';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';

export type InstitutionBackupType = 'DAILY' | 'MONTHLY' | 'MANUAL' | 'EXPORT';

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
// Keep tenant objects below the same prefix as disaster-recovery dumps so the
// bucket-scoped B2 key can remain restricted to one narrow namespace.
const BACKUP_PREFIX = 'postgres-backups/institutions';
const EXPORT_REDACTED_COLUMNS = new Set([
  'password_hash', 'admin_password_hash', 'security_question', 'security_answer_hash',
  'token', 'token_hash', 'expo_push_token', 'reset_token', 'temporary_password',
]);

export const INSTITUTION_BACKUP_DEPENDENT_TABLES: Record<string, string> = {
  announcement_reads: 'announcement_id IN (SELECT id FROM announcements WHERE institution_id = $1)',
  batch_exam_subjects: 'batch_exam_id IN (SELECT id FROM batch_exams WHERE institution_id = $1)',
  batch_exam_results: 'batch_exam_subject_id IN (SELECT s.id FROM batch_exam_subjects s JOIN batch_exams e ON e.id = s.batch_exam_id WHERE e.institution_id = $1)',
  // Course child tables intentionally do not duplicate institution_id. Follow
  // their parent chain so tenant packages contain class links, lectures and each
  // student's watched/read progress, and the restore script uses the same plan.
  course_classes: 'course_id IN (SELECT id FROM courses WHERE institution_id = $1)',
  course_lectures: 'course_id IN (SELECT id FROM courses WHERE institution_id = $1)',
  course_lecture_progress: 'lecture_id IN (SELECT l.id FROM course_lectures l JOIN courses c ON c.id = l.course_id WHERE c.institution_id = $1)',
  fee_invoice_items: 'invoice_id IN (SELECT id FROM fee_invoices WHERE institution_id = $1)',
  online_test_questions: 'online_test_id IN (SELECT id FROM online_tests WHERE institution_id = $1)',
  ticket_history: 'ticket_id IN (SELECT id FROM tickets WHERE institution_id = $1)',
};

function backupConfig() {
  const region = process.env.B2_REGION?.trim();
  const accessKeyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const secretAccessKey = process.env.B2_APPLICATION_KEY?.trim();
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  if (!region || !accessKeyId || !secretAccessKey || !bucket) throw new Error('B2 backup configuration is incomplete');
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: `https://s3.${region}.backblazeb2.com`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function directConnectionString() {
  const value = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DIRECT_URL or DATABASE_URL is required for institution backups');
  return value;
}

function quoteIdentifier(value: string) {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Unsafe database identifier: ${value}`);
  return `"${value}"`;
}

function slugPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'institution';
}

async function writeLine(stream: NodeJS.WritableStream, value: unknown) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain');
}

async function sha256File(path: string) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

type TablePlan = { table: string; columns: string[]; where: string };

async function loadTablePlan(client: pg.PoolClient, exportMode: boolean): Promise<TablePlan[]> {
  const result = await client.query<{ table_name: string; column_name: string; ordinal_position: number }>(`
    SELECT c.table_name, c.column_name, c.ordinal_position
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND (c.table_name = 'institutions' OR c.table_name IN (
        SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'institution_id'
      ) OR c.table_name = ANY($1::text[]))
    ORDER BY c.table_name, c.ordinal_position
  `, [Object.keys(INSTITUTION_BACKUP_DEPENDENT_TABLES)]);

  const grouped = new Map<string, string[]>();
  for (const row of result.rows) {
    // Operational queues must never be restored: doing so could resend old
    // credentials or notifications after a tenant recovery.
    if (row.table_name === 'institution_backups' || row.table_name === 'email_outbox') continue;
    if (exportMode && EXPORT_REDACTED_COLUMNS.has(row.column_name)) continue;
    const columns = grouped.get(row.table_name) ?? [];
    columns.push(row.column_name);
    grouped.set(row.table_name, columns);
  }

  return [...grouped.entries()].map(([table, columns]) => ({
    table,
    columns,
    where: table === 'institutions'
      ? 'id = $1'
      : INSTITUTION_BACKUP_DEPENDENT_TABLES[table] ?? 'institution_id = $1',
  }));
}

async function createSnapshotFile(institutionId: number, type: InstitutionBackupType) {
  const pool = new pg.Pool({ connectionString: directConnectionString(), max: 1, connectionTimeoutMillis: 10_000, application_name: 'nisaab360_tenant_backup' });
  const client = await pool.connect();
  const directory = join(tmpdir(), 'nisaab360-tenant-backups');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${institutionId}-${randomUUID()}.jsonl.gz`);
  const output = createWriteStream(path, { flags: 'wx', mode: 0o600 });
  const gzip = createGzip({ level: 6 });
  gzip.pipe(output);

  let recordCount = 0;
  let tableCount = 0;
  const tableCounts: Record<string, number> = {};
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const institutionResult = await client.query<{ id: number; name: string; username: string }>('SELECT id, name, username FROM institutions WHERE id = $1', [institutionId]);
    const institution = institutionResult.rows[0];
    if (!institution) throw new Error('Institution does not exist');

    const exportMode = type === 'EXPORT';
    const plan = await loadTablePlan(client, exportMode);
    await writeLine(gzip, {
      type: 'header', format: 'nisaab360-institution-backup', version: 1,
      backupType: type, institution, generatedAt: new Date().toISOString(),
      sensitiveFieldsIncluded: !exportMode,
    });

    for (const item of plan) {
      const columnSql = item.columns.map(quoteIdentifier).join(', ');
      const query = `SELECT ${columnSql} FROM ${quoteIdentifier(item.table)} WHERE ${item.where} ORDER BY 1`;
      const rowStream = client.query(new QueryStream(query, [institutionId], { batchSize: 500 }));
      let count = 0;
      for await (const row of rowStream) {
        await writeLine(gzip, { type: 'row', table: item.table, data: row });
        count += 1;
      }
      tableCounts[item.table] = count;
      tableCount += 1;
      recordCount += count;
    }

    await writeLine(gzip, { type: 'manifest', tableCounts, tableCount, recordCount });
    gzip.end();
    await once(output, 'finish');
    await client.query('COMMIT');
    return { path, institution, recordCount, tableCount };
  } catch (error) {
    gzip.destroy();
    output.destroy();
    try { await client.query('ROLLBACK'); } catch {}
    await rm(path, { force: true });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function enqueueScheduledInstitutionBackups(now = new Date()) {
  const dailyKey = now.toISOString().slice(0, 10);
  const monthlyKey = now.toISOString().slice(0, 7);
  // A worker can be interrupted after claiming a job. Make that job retryable
  // instead of leaving it permanently stuck as RUNNING.
  await db.execute(sql`
    UPDATE institution_backups
    SET status = 'PENDING', started_at = NULL, error = 'Worker interrupted; retrying.'
    WHERE status = 'RUNNING' AND started_at < now() - interval '2 hours'
  `);
  await db.execute(sql`
    UPDATE institution_backups
    SET status = 'PENDING', started_at = NULL, completed_at = NULL
    WHERE status = 'FAILED' AND backup_type IN ('DAILY', 'MONTHLY')
      AND attempt_count < 3 AND completed_at < now() - interval '15 minutes'
  `);
  await db.execute(sql`
    INSERT INTO institution_backups (institution_id, backup_type, period_key)
    SELECT id, 'DAILY', ${dailyKey} FROM institutions WHERE status = 'APPROVED'
    ON CONFLICT (institution_id, backup_type, period_key) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO institution_backups (institution_id, backup_type, period_key)
    SELECT id, 'MONTHLY', ${monthlyKey} FROM institutions WHERE status = 'APPROVED'
    ON CONFLICT (institution_id, backup_type, period_key) DO NOTHING
  `);
}

export async function enqueueInstitutionBackup(institutionId: number, type: 'MANUAL' | 'EXPORT', requestedBy: number) {
  const [active] = await db.select({ id: institutionBackups.id }).from(institutionBackups).where(and(
    eq(institutionBackups.institutionId, institutionId),
    eq(institutionBackups.backupType, type),
    inArray(institutionBackups.status, ['PENDING', 'RUNNING']),
  )).limit(1);
  if (active) return (await db.select().from(institutionBackups).where(and(
    eq(institutionBackups.id, active.id),
    eq(institutionBackups.institutionId, institutionId),
  )).limit(1))[0];
  const periodKey = `${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;
  const [job] = await db.insert(institutionBackups).values({ institutionId, backupType: type, periodKey, requestedBy }).returning();
  return job;
}

export async function processNextInstitutionBackup() {
  const claimed = await db.execute<{
    id: number; institution_id: number; backup_type: InstitutionBackupType; period_key: string;
  }>(sql`
    UPDATE institution_backups SET status = 'RUNNING', started_at = now(), error = NULL, attempt_count = attempt_count + 1
    WHERE id = (
      SELECT id FROM institution_backups WHERE status = 'PENDING' ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id, institution_id, backup_type, period_key
  `);
  const job = claimed.rows[0];
  if (!job) return { processed: 0 };

  let temporaryPath: string | undefined;
  let uploadedObject: { client: S3Client; bucket: string; key: string } | undefined;
  try {
    const snapshot = await createSnapshotFile(job.institution_id, job.backup_type);
    temporaryPath = snapshot.path;
    const file = await stat(snapshot.path);
    const checksum = await sha256File(snapshot.path);
    const category = job.backup_type.toLowerCase();
    const objectKey = `${BACKUP_PREFIX}/${job.institution_id}-${slugPart(snapshot.institution.username || snapshot.institution.name)}/${category}/${job.period_key}.jsonl.gz`;
    const { client, bucket } = backupConfig();
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: objectKey, Body: createReadStream(snapshot.path), ContentLength: file.size,
      ContentType: 'application/gzip', Metadata: {
        institutionId: String(job.institution_id), backupType: job.backup_type,
        sha256: checksum, recordCount: String(snapshot.recordCount),
      },
    }));
    uploadedObject = { client, bucket, key: objectKey };
    const remote = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (Number(remote.ContentLength) !== file.size || remote.Metadata?.sha256 !== checksum) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })).catch(() => undefined);
      throw new Error('Remote backup verification failed');
    }
    await db.update(institutionBackups).set({
      status: 'COMPLETED', objectKey, fileSize: file.size, sha256: checksum,
      recordCount: snapshot.recordCount, tableCount: snapshot.tableCount, completedAt: new Date(), error: null,
    }).where(and(
      eq(institutionBackups.id, job.id),
      eq(institutionBackups.institutionId, job.institution_id),
    ));
    return { processed: 1, backupId: job.id };
  } catch (error) {
    if (uploadedObject) {
      await uploadedObject.client.send(new DeleteObjectCommand({ Bucket: uploadedObject.bucket, Key: uploadedObject.key })).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message.slice(0, 2000) : 'Unknown backup failure';
    await db.update(institutionBackups).set({ status: 'FAILED', error: message, completedAt: new Date() }).where(and(
      eq(institutionBackups.id, job.id),
      eq(institutionBackups.institutionId, job.institution_id),
    ));
    throw error;
  } finally {
    if (temporaryPath) await rm(temporaryPath, { force: true });
  }
}

export async function pruneInstitutionBackups(now = new Date()) {
  // tenant-audit: allow-cross-tenant institutionBackups — this singleton retention worker prunes every institution by age policy.
  const cutoffs: Array<{ types: InstitutionBackupType[]; before: Date }> = [
    { types: ['DAILY', 'MANUAL', 'EXPORT'], before: new Date(now.getTime() - 30 * 86_400_000) },
    { types: ['MONTHLY'], before: new Date(now.getTime() - 366 * 86_400_000) },
  ];
  const { client, bucket } = backupConfig();
  let deleted = 0;
  for (const cutoff of cutoffs) {
    const rows = await db.select({ id: institutionBackups.id, objectKey: institutionBackups.objectKey })
      .from(institutionBackups)
      .where(and(inArray(institutionBackups.backupType, cutoff.types), eq(institutionBackups.status, 'COMPLETED'), lt(institutionBackups.completedAt, cutoff.before)))
      .limit(100);
    for (const row of rows) {
      if (row.objectKey) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.objectKey }));
      await db.delete(institutionBackups).where(eq(institutionBackups.id, row.id));
      deleted += 1;
    }
  }
  return { deleted };
}

export async function getInstitutionBackupObject(objectKey: string) {
  if (!objectKey.startsWith(`${BACKUP_PREFIX}/`)) throw new Error('Invalid institution backup object key');
  const { client, bucket } = backupConfig();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
}
