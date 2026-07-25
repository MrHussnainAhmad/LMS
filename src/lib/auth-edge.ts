import { jwtVerify } from 'jose';
import { UserRole, JWTPayload } from './auth-types'; // We'll move types here

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-12345');

const jwtKeyPromise = crypto.subtle.importKey(
  'raw',
  JWT_SECRET,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);

/**
 * Short-lived verified-token memo (signature already checked).
 *
 * Cache key: token string (not logged)
 * Scope: process-local only; never shared across tenants via key alone
 * TTL: min(30s, remaining JWT lifetime)
 * Max entries: 500 (evict oldest insertion)
 * Acceptable staleness: up to 30s after revoke until validity cache / next full check
 * Fallback: on miss, full jwtVerify
 *
 * Does NOT replace verifyUserExists — callers that need deactivation checks
 * must still call getSession / getSessionFromRequest.
 */
const VERIFIED_TOKEN_TTL_MS = 30_000;
const VERIFIED_TOKEN_MAX = 500;
const verifiedTokenCache = new Map<string, { payload: JWTPayload; expMs: number }>();

function rememberVerifiedToken(token: string, payload: JWTPayload) {
  const now = Date.now();
  const expClaim = (payload as unknown as { exp?: number }).exp;
  const jwtExpMs = typeof expClaim === 'number' ? expClaim * 1000 : now + VERIFIED_TOKEN_TTL_MS;
  const expMs = Math.min(now + VERIFIED_TOKEN_TTL_MS, jwtExpMs);
  if (expMs <= now) return;

  if (verifiedTokenCache.size >= VERIFIED_TOKEN_MAX) {
    const oldest = verifiedTokenCache.keys().next().value;
    if (oldest !== undefined) verifiedTokenCache.delete(oldest);
  }
  verifiedTokenCache.set(token, { payload, expMs });
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  const cached = verifiedTokenCache.get(token);
  if (cached) {
    if (cached.expMs > Date.now()) return cached.payload;
    verifiedTokenCache.delete(token);
  }

  try {
    const key = await jwtKeyPromise;
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const typed = payload as unknown as JWTPayload;
    rememberVerifiedToken(token, typed);
    return typed;
  } catch {
    return null;
  }
}

export async function getSessionEdge(requestCookies: { get: (name: string) => { value: string } | undefined }): Promise<JWTPayload | null> {
  const token = requestCookies.get('access_token')?.value;
  if (!token) return null;
  return await verifyAccessToken(token);
}

export type { UserRole, JWTPayload };
