import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://valkey:6379';
const FETCH_TIMEOUT_MS = 60_000;

const isBuildPhase = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build';

export const redis = isBuildPhase 
  ? ({
      status: 'end',
      get: async () => null,
      setex: async () => null,
      del: async () => 0,
      quit: async () => 'OK',
      disconnect: () => undefined,
      on: () => {},
    } as unknown as Redis)
  : new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: true,
      lazyConnect: false,
    });

let errorLogged = false;
redis.on('error', (err) => {
  if (!errorLogged) {
    console.warn('Valkey/Redis connection error (fallback to DB):', err.message);
    console.warn('Suppressing further Redis connection errors...');
    errorLogged = true;
  }
});

const inFlightRequests = new Map<string, Promise<unknown>>();

/** Drop stampede-dedupe entries on shutdown so the process can exit. */
export function clearInFlightCacheFetches() {
  inFlightRequests.clear();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function runDedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const fetchPromise = (async () => {
    try {
      return await withTimeout(fetcher(), FETCH_TIMEOUT_MS, `cache fetch ${key}`);
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

export async function getCachedOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    if (redis.status === 'ready') {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn(`Redis get error for ${key}:`, err);
  }

  const fresh = await runDedupedFetch(key, fetcher);

  try {
    if (redis.status === 'ready') {
      const jitter = Math.floor(ttlSeconds * (0.05 + Math.random() * 0.05));
      await redis.setex(key, ttlSeconds + jitter, JSON.stringify(fresh));
    }
  } catch (err) {
    console.warn(`Redis setex error for ${key}:`, err);
  }

  return fresh;
}

async function deleteKeysByPattern(pattern: string) {
  if (redis.status !== 'ready') return;
  try {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const keysToDelete: string[] = [];
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length) keysToDelete.push(...keys);
    }
    // UNLINK, not DEL: reclaiming memory happens on a background thread, so a
    // large invalidation never stalls the single Valkey command loop that every
    // request's cache lookup is queued behind.
    if (keysToDelete.length) {
      for (let i = 0; i < keysToDelete.length; i += 500) {
        await redis.unlink(...keysToDelete.slice(i, i + 500));
      }
    }
  } catch (err) {
    console.warn(`Redis SCAN/delete error for pattern ${pattern}:`, err);
  }
}

/** Call after students are created/deleted or tests are created so roster/marks caches don't serve stale data. */
export async function invalidateInstitutionRosterCaches(institutionId: number) {
  if (redis.status !== 'ready') return;
  try {
    await redis.del(
      `cache:rosters:${institutionId}`,
      `cache:dashboard:${institutionId}`,
      `cache:dashboard:students:${institutionId}`,
      `cache:dashboard:class-dist:${institutionId}`,
    );
    // Deliberately no `cache:staff:marks:*` SCAN here any more. Nothing writes
    // that key family (the staff marks route is uncached), so the pattern could
    // never match — but SCAN walks the *entire* keyspace regardless of the
    // pattern, in `count: 100` steps, on Valkey's single command thread. That
    // was a full keyspace walk on every student create/update/delete and every
    // staff assessment creation, in front of every concurrent cache lookup.
  } catch (err) {
    console.warn(`Cache invalidation error for institution ${institutionId}:`, err);
  }
}

/** Invalidate individual student dashboard cache when assignment/mark changes occur. */
export async function invalidateStudentDashboardCache(institutionId: number, studentId: number) {
  if (redis.status !== 'ready') return;
  try {
    // The web dashboard key is suffixed with `new Date().getDay()`, so the key
    // set is exactly seven — enumerate them instead of SCANning the keyspace.
    const webKeys = Array.from({ length: 7 }, (_, day) => `cache:student:dashboard:web:${studentId}:${institutionId}:${day}`);
    await redis.unlink(`cache:student:dashboard:${studentId}:${institutionId}`, ...webKeys);
  } catch (err) {
    console.warn(`Cache invalidation error for student dashboard ${studentId}:${institutionId}:`, err);
  }
}

/** Invalidate bounded marks responses and dashboards after results change or publish. */
export async function invalidateStudentMarksCaches(institutionId: number, studentIds: number[]) {
  if (redis.status !== 'ready' || studentIds.length === 0) return;
  try {
    const uniqueStudentIds = Array.from(new Set(studentIds));
    for (let offset = 0; offset < uniqueStudentIds.length; offset += 100) {
      const pipeline = redis.pipeline();
      for (const studentId of uniqueStudentIds.slice(offset, offset + 100)) {
        pipeline.incr(`cache:student:marks:version:${studentId}`);
        pipeline.unlink(
          `cache:student:marks:${studentId}:default`,
          `cache:student:dashboard:${studentId}:${institutionId}`,
          ...Array.from({ length: 7 }, (_, day) => `cache:student:dashboard:web:${studentId}:${institutionId}:${day}`),
        );
      }
      await pipeline.exec();
    }
  } catch (err) {
    console.warn(`Marks cache invalidation error for institution ${institutionId}:`, err);
  }
}

export function studentEnrichCacheKey(institutionId: number, studentId: number) {
  return `cache:student:enrich:${institutionId}:${studentId}`;
}

/**
 * Drop the cached academic-status enrichment (see `enrichSession` in lib/auth.ts).
 *
 * Call with `studentIds` when specific students change academic status, and
 * without it when an institution-wide setting changes — the latter SCANs, but it
 * only ever runs on an admin toggle, not on request traffic.
 */
export async function invalidateStudentEnrichCache(institutionId: number, studentIds?: number[]) {
  if (redis.status !== 'ready') return;
  try {
    if (studentIds && studentIds.length > 0) {
      const keys = studentIds.map((id) => studentEnrichCacheKey(institutionId, id));
      // Chunked: a whole-batch promotion can pass thousands of ids, and one
      // enormous DEL would block the single Valkey thread.
      for (let i = 0; i < keys.length; i += 500) {
        await redis.unlink(...keys.slice(i, i + 500));
      }
      return;
    }
    await deleteKeysByPattern(`cache:student:enrich:${institutionId}:*`);
  } catch (err) {
    console.warn(`Cache invalidation error for student enrichment ${institutionId}:`, err);
  }
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

  const fresh = await runDedupedFetch(key, fetcher);

  try {
    if (redis.status === 'ready') {
      const jitter = Math.floor(ttlSeconds * (0.05 + Math.random() * 0.05));
      await redis.setex(key, ttlSeconds + jitter, fresh);
    }
  } catch (err) {
    console.warn(`Redis setex error for ${key}:`, err);
  }

  return fresh;
}
