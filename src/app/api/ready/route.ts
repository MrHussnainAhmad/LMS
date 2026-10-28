import { readinessPool } from '@/db';
import { redis } from '@/lib/redis';
import { withApiPolicy } from '@/lib/api-policy';
export { corsPreflight as OPTIONS } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export const GET = withApiPolicy(async () => {
  try {
    await readinessPool.query('select 1');
    // Fail readiness on migration drift before accepting backup jobs/traffic.
    await readinessPool.query('select b2_status, error, source_sha256, source_size_bytes, started_at from central_database_backups where false');
    await readinessPool.query('select database_password_encrypted, updated_by_employee from central_backup_settings where false');
    let cache: 'ready' | 'degraded' = 'degraded';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (redis.status === 'ready' && await Promise.race([
        redis.ping(),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1000); }),
      ]) === 'PONG') cache = 'ready';
    } catch {} finally { clearTimeout(timer); }
    return Response.json({ status: cache === 'ready' ? 'ready' : 'degraded', database: 'ready', cache }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable', database: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
});
