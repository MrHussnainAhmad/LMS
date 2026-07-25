import { NextRequest } from 'next/server';
import { redis } from './redis';

export type PlatformLoginKind = 'super-admin' | 'mini-admin' | 'employee';

export type RateLimitBucket =
  | 'auth'
  | 'api'
  | 'refresh'
  | 'export'
  | 'import'
  | 'heartbeat'
  | 'unread'
  | 'marks_write';

const BUCKET_LIMITS: Record<RateLimitBucket, { limit: number; windowSeconds: number }> = {
  auth: { limit: 5, windowSeconds: 60 },
  api: { limit: 100, windowSeconds: 60 },
  refresh: { limit: 30, windowSeconds: 60 },
  export: { limit: 3, windowSeconds: 60 },
  import: { limit: 5, windowSeconds: 60 },
  heartbeat: { limit: 20, windowSeconds: 60 },
  unread: { limit: 60, windowSeconds: 60 },
  marks_write: { limit: 30, windowSeconds: 60 },
};

async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (redis.status !== 'ready') return true;

  try {
    const current = await redis.get(key);
    if (current && parseInt(current, 10) >= limit) {
      return false;
    }

    const multi = redis.multi();
    multi.incr(key);
    if (!current) {
      multi.expire(key, windowSeconds);
    }
    await multi.exec();
    return true;
  } catch (err) {
    console.error('Rate limit error:', err);
    return true; // Fail open
  }
}

function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}

export async function withRateLimit(
  req: NextRequest,
  type: RateLimitBucket = 'api',
  identity?: string | number,
) {
  const { limit, windowSeconds } = BUCKET_LIMITS[type] ?? BUCKET_LIMITS.api;
  const ip = clientIp(req);
  const suffix = identity !== undefined ? `:${identity}` : '';
  const success = await checkRateLimit(`ratelimit:${type}:${ip}${suffix}`, limit, windowSeconds);
  return { success };
}

export async function withPlatformLoginRateLimit(
  req: NextRequest,
  kind: PlatformLoginKind,
  loginIdentifier: string,
) {
  const ip = clientIp(req);
  const key = `ratelimit:login:${kind}:${ip}:${loginIdentifier}`;

  let limit = 5;
  if (kind === 'super-admin') limit = 2;
  else if (kind === 'employee') limit = 10;

  const success = await checkRateLimit(key, limit, 60);
  return { success };
}
