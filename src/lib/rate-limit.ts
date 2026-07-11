import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Auth Routes: 5 requests per minute
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
});

export type PlatformLoginKind = 'super-admin' | 'mini-admin' | 'employee';

const platformLoginRateLimits: Record<PlatformLoginKind, Ratelimit> = {
  'super-admin': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, '1 m'),
    analytics: true,
    prefix: 'ratelimit:login:super-admin',
  }),
  'mini-admin': new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'ratelimit:login:mini-admin',
  }),
  employee: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'ratelimit:login:employee',
  }),
};

// General API: 100 requests per minute
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

export async function withRateLimit(req: NextRequest, type: 'auth' | 'api' = 'api') {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    // Return a dummy success if upstash is not configured
    return { success: true };
  }

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const limiter = type === 'auth' ? authRateLimit : apiRateLimit;
  
  const identifier = `${type}_${ip}`;
  const { success } = await limiter.limit(identifier);

  return { success };
}

export async function withPlatformLoginRateLimit(
  req: NextRequest,
  kind: PlatformLoginKind,
  loginIdentifier: string,
) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { success: true };
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1';
  const identifier = `${ip}:${loginIdentifier}`;

  return platformLoginRateLimits[kind].limit(identifier);
}
