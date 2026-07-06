import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

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
