import { pool } from '@/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await pool.query('select 1');
    let cache: 'ready' | 'degraded' = 'degraded';
    try {
      if (redis.status === 'ready' && await redis.ping() === 'PONG') cache = 'ready';
    } catch {}
    return Response.json({ status: cache === 'ready' ? 'ready' : 'degraded', database: 'ready', cache }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable', database: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
