import { Pool, type PoolClient } from 'pg';

export class BackupBusyError extends Error {}

// A session lock MUST bypass PgBouncer's transaction pool. No long-running SQL
// transaction is held while encrypting/uploading. One lock covers both replicas.
export async function withCentralBackupLock<T>(work: (client: PoolClient, signal: AbortSignal) => Promise<T>): Promise<T> {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl || /(:6432\b|pgbouncer=true)/i.test(directUrl)) throw new Error('Central backup requires a direct PostgreSQL connection');
  const pool = new Pool({ connectionString: directUrl, max: 1, connectionTimeoutMillis: 10000,
    query_timeout: 10000, statement_timeout: 10000, application_name: 'nisaab360_central_backup' });
  let client: PoolClient | undefined;
  let locked = false;
  const controller = new AbortController();
  const onError = () => controller.abort();
  try {
    client = await pool.connect();
    client.on('error', onError);
    const result = await client.query("SELECT pg_try_advisory_lock(hashtext('nisaab360-central-backup')) AS locked");
    locked = result.rows[0]?.locked === true;
    if (!locked) throw new BackupBusyError('A central backup is already running');
    return await work(client, AbortSignal.any([controller.signal, AbortSignal.timeout(50 * 60 * 1000)]));
  } finally {
    if (client) {
      if (locked && !controller.signal.aborted) await client.query("SELECT pg_advisory_unlock(hashtext('nisaab360-central-backup'))").catch(() => undefined);
      client.removeListener('error', onError);
      client.release(true);
    }
    await pool.end();
  }
}
