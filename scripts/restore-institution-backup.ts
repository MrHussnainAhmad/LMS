import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import pg from 'pg';
import { db, pool as appPool } from '@/db';
import { institutionBackups } from '@/db/schema';
import { getInstitutionBackupObject, INSTITUTION_BACKUP_DEPENDENT_TABLES } from '@/lib/institution-backups';
import { and, eq } from 'drizzle-orm';

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function quote(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe identifier ${value}`);
  return `"${value}"`;
}

async function main() {
const institutionId = Number.parseInt(argument('institution') || '', 10);
const backupId = Number.parseInt(argument('backup-id') || '', 10);
const safetyBackupId = Number.parseInt(argument('safety-backup-id') || '', 10);
const actorId = Number.parseInt(argument('actor-id') || '', 10);
const confirmation = argument('confirm');
const apply = process.argv.includes('--apply');
const validateOnly = process.argv.includes('--validate-only');
if (apply === validateOnly) throw new Error('Choose exactly one of --validate-only or --apply');
if (!Number.isInteger(institutionId) || !Number.isInteger(backupId)) throw new Error('Valid --institution and --backup-id are required');
if (apply && (!Number.isInteger(safetyBackupId) || !Number.isInteger(actorId))) throw new Error('--apply requires valid --safety-backup-id and --actor-id');
if (apply && confirmation !== `RESTORE-INSTITUTION-${institutionId}`) throw new Error(`Confirmation must be --confirm=RESTORE-INSTITUTION-${institutionId}`);
if (apply && backupId === safetyBackupId) throw new Error('Restore backup and safety backup must be different');

const [target] = await db.select().from(institutionBackups).where(and(eq(institutionBackups.id, backupId), eq(institutionBackups.institutionId, institutionId))).limit(1);
const [safety] = apply
  ? await db.select().from(institutionBackups).where(and(eq(institutionBackups.id, safetyBackupId), eq(institutionBackups.institutionId, institutionId))).limit(1)
  : [undefined];
if (!target?.objectKey || target.status !== 'COMPLETED' || target.backupType === 'EXPORT' || !target.sha256) throw new Error('Target must be a completed recovery backup for this institution');
if (apply && (!safety?.objectKey || safety.status !== 'COMPLETED' || safety.backupType !== 'MANUAL' || !safety.completedAt)) throw new Error('Safety backup must be a completed MANUAL backup');
if (apply && safety?.completedAt && Date.now() - safety.completedAt.getTime() > 2 * 60 * 60 * 1000) throw new Error('Safety backup must have completed within the last two hours');

const tempDirectory = join(tmpdir(), 'nisaab360-tenant-restore');
await mkdir(tempDirectory, { recursive: true });
const backupPath = join(tempDirectory, `restore-${backupId}-${Date.now()}.jsonl.gz`);
const object = await getInstitutionBackupObject(target.objectKey);
if (!object.Body) throw new Error('Backup object is empty');
await pipeline(object.Body as unknown as Readable, createWriteStream(backupPath, { flags: 'wx', mode: 0o600 }));
const hash = createHash('sha256');
await pipeline(createReadStream(backupPath), hash);
if (hash.digest('hex') !== target.sha256) throw new Error('Backup checksum does not match metadata');

const connectionString = process.env.DIRECT_URL?.trim();
if (!connectionString) throw new Error('DIRECT_URL is required');
if (apply && /(:6432\b|pgbouncer=true)/i.test(connectionString)) throw new Error('DIRECT_URL must connect directly to PostgreSQL for an applied restore');
const restorePool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, application_name: 'nisaab360_tenant_restore' });
const client = await restorePool.connect();

type Manifest = { recordCount?: number; tableCounts?: Record<string, number> };
let headerInstitutionId: number | undefined;
let manifest: Manifest | undefined;
let parsedRecords = 0;
const presentTables = new Set<string>();
let stagedBatch: Array<{ table: string; data: unknown }> = [];

async function flushStage() {
  if (stagedBatch.length === 0) return;
  const values: unknown[] = [];
  const placeholders = stagedBatch.map((row, index) => {
    values.push(row.table, JSON.stringify(row.data));
    return `($${index * 2 + 1}, $${index * 2 + 2}::jsonb)`;
  });
  await client.query(`INSERT INTO tenant_restore_stage (table_name, row_data) VALUES ${placeholders.join(',')}`, values);
  stagedBatch = [];
}

try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext(\'nisaab360-tenant-restore\'), $1)', [institutionId]);
  await client.query('CREATE TEMP TABLE tenant_restore_stage (table_name text NOT NULL, row_data jsonb NOT NULL) ON COMMIT DROP');
  const lines = createInterface({ input: createReadStream(backupPath).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const value = JSON.parse(line) as { type?: string; table?: string; data?: unknown; institution?: { id?: number } } & Manifest;
    if (value.type === 'header') headerInstitutionId = Number(value.institution?.id);
    else if (value.type === 'manifest') manifest = value;
    else if (value.type === 'row' && value.table && value.data) {
      if (!/^[a-z_][a-z0-9_]*$/.test(value.table)) throw new Error('Backup contains an invalid table name');
      presentTables.add(value.table); parsedRecords += 1;
      stagedBatch.push({ table: value.table, data: value.data });
      if (stagedBatch.length >= 200) await flushStage();
    }
  }
  await flushStage();
  if (headerInstitutionId !== institutionId) throw new Error('Backup belongs to a different institution');
  if (!manifest || Number(manifest.recordCount) !== parsedRecords) throw new Error('Backup manifest record count is invalid');
  for (const table of Object.keys(manifest.tableCounts ?? {})) presentTables.add(table);

  const allowedResult = await client.query<{ table_name: string }>(`
    SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND (column_name = 'institution_id' OR table_name = 'institutions' OR table_name = ANY($1::text[]))
  `, [Object.keys(INSTITUTION_BACKUP_DEPENDENT_TABLES)]);
  const allowed = new Set(allowedResult.rows.map((row) => row.table_name));
  for (const table of presentTables) if (!allowed.has(table) || table === 'institution_backups') throw new Error(`Backup contains a non-tenant table: ${table}`);

  const tableNames = [...presentTables];
  const foreignKeys = await client.query<{ child: string; parent: string }>(`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public' AND child.relname = ANY($1::text[]) AND parent.relname = ANY($1::text[])
  `, [tableNames]);
  const dependencies = new Map(tableNames.map((table) => [table, new Set<string>()]));
  for (const fk of foreignKeys.rows) dependencies.get(fk.child)?.add(fk.parent);
  const insertionOrder: string[] = [];
  const remaining = new Set(tableNames);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((table) => [...(dependencies.get(table) ?? [])].every((parent) => !remaining.has(parent))).sort();
    if (ready.length === 0) throw new Error(`Cannot safely order tenant tables: ${[...remaining].join(', ')}`);
    for (const table of ready) { insertionOrder.push(table); remaining.delete(table); }
  }

  if (validateOnly) {
    await client.query('ROLLBACK');
    process.stdout.write(`Validated institution ${institutionId} backup ${backupId}: ${parsedRecords} records across ${tableNames.length} tenant tables; no data changed.\n`);
    return;
  }

  for (const table of [...insertionOrder].reverse()) {
    if (table === 'institutions') continue;
    const predicate = INSTITUTION_BACKUP_DEPENDENT_TABLES[table] ?? 'institution_id = $1';
    await client.query(`DELETE FROM ${quote(table)} WHERE ${predicate}`, [institutionId]);
  }
  for (const table of insertionOrder) {
    if (table === 'institutions') continue;
    await client.query(`INSERT INTO ${quote(table)} SELECT (jsonb_populate_record(NULL::${quote(table)}, row_data)).* FROM tenant_restore_stage WHERE table_name = $1`, [table]);
    const sequence = await client.query<{ name: string | null }>('SELECT pg_get_serial_sequence($1, $2) AS name', [`public.${table}`, 'id']);
    if (sequence.rows[0]?.name) {
      // IDs are global across tenants. Advancing to the table-wide maximum is
      // safe even after a prior TRUNCATE ... RESTART IDENTITY incident.
      await client.query(`SELECT setval($1, COALESCE((SELECT max(id) FROM ${quote(table)}), 1), EXISTS (SELECT 1 FROM ${quote(table)}))`, [sequence.rows[0].name]);
    }
  }

  const counts = await client.query<{ table_name: string; count: number }>('SELECT table_name, count(*)::int AS count FROM tenant_restore_stage GROUP BY table_name');
  const actualCounts = new Map(counts.rows.map((row) => [row.table_name, row.count]));
  for (const [table, expected] of Object.entries(manifest.tableCounts ?? {})) {
    if ((actualCounts.get(table) ?? 0) !== expected) throw new Error(`Post-restore count mismatch for ${table}`);
    if (table === 'institutions') continue;
    const predicate = INSTITUTION_BACKUP_DEPENDENT_TABLES[table] ?? 'institution_id = $1';
    const restored = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${quote(table)} WHERE ${predicate}`, [institutionId]);
    if (restored.rows[0]?.count !== expected) throw new Error(`Live row count mismatch for ${table}`);
  }
  await client.query(`INSERT INTO audit_logs (institution_id, actor_id, actor_role, action, target, ip)
    VALUES ($1, $2, 'SUPER_ADMIN', 'RESTORE_INSTITUTION_BACKUP', $3, '127.0.0.1')`,
    [institutionId, actorId, `Backup ${backupId}; safety backup ${safetyBackupId}`]);
  await client.query('COMMIT');
  process.stdout.write(`Restored institution ${institutionId} from backup ${backupId}; safety backup ${safetyBackupId} remains available.\n`);
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  throw error;
} finally {
  client.release();
  await restorePool.end();
  await appPool.end();
  await rm(backupPath, { force: true });
}

}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try { await appPool.end(); } catch {}
  process.exitCode = 1;
});
