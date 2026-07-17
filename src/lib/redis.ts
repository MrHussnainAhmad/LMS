import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://valkey:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.warn('Valkey/Redis connection error (fallback to DB):', err.message);
});

const inFlightRequests = new Map<string, Promise<any>>();

export async function getCachedOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn(`Redis get error for ${key}:`, err);
  }

  // Deduplicate in-flight requests to prevent stampede
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const fresh = await fetcher();
      
      try {
        if (redis.status === 'ready') {
          // Add 5-10% jitter to TTL to prevent simultaneous expiry
          const jitter = Math.floor(ttlSeconds * (0.05 + Math.random() * 0.05));
          await redis.setex(key, ttlSeconds + jitter, JSON.stringify(fresh));
        }
      } catch (err) {
        console.warn(`Redis setex error for ${key}:`, err);
      }
      
      return fresh;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

export async function getRawCachedOrFetch(key: string, ttlSeconds: number, fetcher: () => Promise<string>): Promise<string> {
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(key);
      if (cached) return cached;
    }
  } catch (err) {
    console.warn(`Redis get error for ${key}:`, err);
  }

  if (inFlightRequests.has(key)) return inFlightRequests.get(key) as Promise<string>;

  const fetchPromise = (async () => {
    try {
      const fresh = await fetcher();
      try {
        if (redis.status === 'ready') {
          const jitter = Math.floor(ttlSeconds * (0.05 + Math.random() * 0.05));
          await redis.setex(key, ttlSeconds + jitter, fresh);
        }
      } catch (err) {
        console.warn(`Redis setex error for ${key}:`, err);
      }
      return fresh;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}
