import { NextRequest } from 'next/server';
import { redis } from './redis';

export type PlatformLoginKind = 'super-admin' | 'mini-admin' | 'employee';

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

export async function withRateLimit(req: NextRequest, type: 'auth' | 'api' = 'api') {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  
  if (type === 'auth') {
    // Auth Routes: 5 requests per minute
    const success = await checkRateLimit(`ratelimit:auth:${ip}`, 5, 60);
    return { success };
  } else {
    // General API: 100 requests per minute
    const success = await checkRateLimit(`ratelimit:api:${ip}`, 100, 60);
    return { success };
  }
}

export async function withPlatformLoginRateLimit(
  req: NextRequest,
  kind: PlatformLoginKind,
  loginIdentifier: string,
) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1';
  const key = `ratelimit:login:${kind}:${ip}:${loginIdentifier}`;

  let limit = 5;
  if (kind === 'super-admin') limit = 2;
  else if (kind === 'employee') limit = 10;

  const success = await checkRateLimit(key, limit, 60);
  return { success };
}
