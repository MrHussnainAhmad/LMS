import { SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { db } from '@/db';
import { institutions, refreshTokens, students } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { UserRole, JWTPayload } from './auth-types';
import { verifyAccessToken, getSessionEdge } from './auth-edge';
import { getJwtSecret } from './jwt-secret';
import { SESSION_HEADER, SESSION_SIG_HEADER, verifySessionPayload } from './session-header';
import { getCachedOrFetch, studentEnrichCacheKey } from './redis';
import { verifyUserExists } from './user';

export { verifyAccessToken };
export type { UserRole, JWTPayload };

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const WEB_SESSION_EXPIRY_DAYS = 5;
const ACCESS_TOKEN_EXPIRY = `${WEB_SESSION_EXPIRY_DAYS}d`;
const REFRESH_TOKEN_PATTERN = /^[a-f0-9]{80}$/i;

function createRefreshTokenMaterial() {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return { refreshToken, tokenHash, expiresAt };
}

async function getCookieScope() {
  const requestHeaders = await headers();
  const host = (requestHeaders.get('host') || '').split(':')[0].toLowerCase();
  const domain = host === 'nisaab360.app' || host.endsWith('.nisaab360.app') ? '.nisaab360.app' : undefined;
  const secure = domain !== undefined && (requestHeaders.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production');
  return { domain, secure };
}

export async function createAccessToken(payload: JWTPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function createTokens(payload: JWTPayload) {
  const accessToken = await createAccessToken(payload);
  const { refreshToken, tokenHash, expiresAt } = createRefreshTokenMaterial();

  await db.insert(refreshTokens).values({
    userRole: payload.role,
    userId: payload.userId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

type RefreshRotationResult =
  | { status: 'ROTATED'; refreshToken: string; userRole: UserRole; userId: number }
  | { status: 'INVALID' | 'EXPIRED' | 'REUSED' };

/**
 * Atomically consumes one refresh token and creates its replacement.
 *
 * The row lock makes a token single-use even when two requests reach different
 * app replicas. If an already-replaced token appears again, every still-active
 * refresh token for that account is revoked: the old token may have been copied.
 */
export async function rotateRefreshToken(presentedToken: string): Promise<RefreshRotationResult> {
  if (!REFRESH_TOKEN_PATTERN.test(presentedToken)) return { status: 'INVALID' };
  const presentedHash = crypto.createHash('sha256').update(presentedToken).digest('hex');

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT ${refreshTokens.id}
      FROM ${refreshTokens}
      WHERE ${refreshTokens.tokenHash} = ${presentedHash}
      FOR UPDATE
    `);
    const [record] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, presentedHash))
      .limit(1);
    if (!record) return { status: 'INVALID' } as const;

    const now = new Date();
    if (record.revokedAt) {
      if (!record.replacedByHash) return { status: 'INVALID' } as const;
      await tx
        .update(refreshTokens)
        .set({ reuseDetectedAt: record.reuseDetectedAt ?? now })
        .where(eq(refreshTokens.id, record.id));
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(
          eq(refreshTokens.userRole, record.userRole),
          eq(refreshTokens.userId, record.userId),
          isNull(refreshTokens.revokedAt),
        ));
      return { status: 'REUSED' } as const;
    }

    if (record.expiresAt <= now) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(eq(refreshTokens.id, record.id));
      return { status: 'EXPIRED' } as const;
    }

    const next = createRefreshTokenMaterial();
    await tx.insert(refreshTokens).values({
      userRole: record.userRole,
      userId: record.userId,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
    });
    await tx
      .update(refreshTokens)
      .set({ revokedAt: now, replacedByHash: next.tokenHash })
      .where(eq(refreshTokens.id, record.id));

    return {
      status: 'ROTATED',
      refreshToken: next.refreshToken,
      userRole: record.userRole,
      userId: record.userId,
    } as const;
  });
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  const { domain, secure } = await getCookieScope();
  
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    domain,
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    domain,
  });

  // Non-HttpOnly cookie for client-side session expiration tracking
  cookieStore.set('session_exp', (Date.now() + WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toString(), {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    domain,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  const { domain } = await getCookieScope();
  const cookieNames = ['access_token', 'refresh_token', 'session_exp'];
  
  for (const name of cookieNames) {
    // Delete without domain (covers cookies set before subdomain changes)
    cookieStore.delete(name);
    // Delete with domain (covers cookies set with domain: '.nisaab360.app')
    if (domain) {
      cookieStore.set(name, '', { path: '/', domain, maxAge: 0 });
    }
  }
}

/**
 * Request-scoped session for RSC pages/layouts.
 *
 * When middleware already verified the JWT it forwards the payload as
 * `x-user-session` plus an HMAC in `x-user-session-sig`. A payload whose
 * signature does not verify is discarded and the cookie is checked instead, so a
 * forged header can neither authenticate nor pick its own role/tenant.
 *
 * For a middleware-signed payload the JWT is not re-verified and the Valkey/DB
 * liveness round-trip is skipped for read-only page renders. API mutations still
 * go through getSessionFromRequest → verifyUserExists.
 *
 * Deactivation is enforced within JWT lifetime (5d) plus every mutating API call.
 * Validity cache invalidation still applies to API traffic immediately.
 */
export const getSession = cache(async (): Promise<JWTPayload | null> => {
  let session: JWTPayload | null = null;
  let fromMiddleware = false;
  const headersList = await headers();
  const sessionHeader = headersList.get(SESSION_HEADER);

  if (sessionHeader) {
    const signed = await verifySessionPayload(sessionHeader, headersList.get(SESSION_SIG_HEADER));
    if (signed) {
      try {
        session = JSON.parse(sessionHeader) as JWTPayload;
        fromMiddleware = true;
      } catch {
        // fallback
      }
    }
  }

  if (!session) {
    const cookieStore = await cookies();
    session = await getSessionEdge(cookieStore);
  }

  if (!session) return null;

  if (!fromMiddleware) {
    const exists = await verifyUserExists(session.role, session.userId);
    if (!exists) return null;
  }

  return enrichSession(session);
});

export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  let session: JWTPayload | null = null;
  const authorization = req.headers.get('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  
  if (bearerToken) {
    session = await verifyAccessToken(bearerToken);
  } else {
    session = await getSessionEdge(req.cookies);
  }

  if (session) {
    const exists = await verifyUserExists(session.role, session.userId);
    if (!exists) return null;
    session = await enrichSession(session);
  }

  return session;
}

/**
 * Backfills the academic-status claims for STUDENT tokens issued before those
 * claims existed. Tokens live 5 days (web) to 30 days (refreshed native), so this
 * is a long tail, not a one-off: without a cache it is an extra `students ⋈
 * institutions` round trip on *every* request from those clients.
 *
 * Cached for 2 minutes and invalidated explicitly by the only two writers of the
 * underlying values — batch promotion (`lib/batch-promotion.ts`) and the
 * institution graduate-access toggle. Freshly minted tokens already carry these
 * claims for their full 5-day lifetime, so a 120s ceiling is strictly tighter
 * than the staleness the current design already accepts.
 */
const ENRICH_CACHE_TTL_SECONDS = 120;

async function enrichSession(session: JWTPayload): Promise<JWTPayload> {
  if (session.role !== 'STUDENT') return session;
  // Login/refresh already embed these claims — skip the join when present.
  if (session.studentAcademicStatus !== undefined && session.graduatedStudentAccessAllowed !== undefined) {
    return session;
  }

  const fetchEnrichment = async () => {
    const [student] = await db.select({
      academicStatus: students.academicStatus,
      graduatedAccessAllowed: institutions.allowGraduatedStudentAccess,
    })
      .from(students)
      .innerJoin(institutions, eq(students.institutionId, institutions.id))
      .where(eq(students.id, session.userId))
      .limit(1);
    return student ?? null;
  };

  // A token without an institutionId claim cannot form the invalidatable key, so
  // it falls through to the uncached query rather than to a key nothing clears.
  const student = session.institutionId
    ? await getCachedOrFetch(
        studentEnrichCacheKey(session.institutionId, session.userId),
        ENRICH_CACHE_TTL_SECONDS,
        fetchEnrichment,
      )
    : await fetchEnrichment();

  if (!student) return session;
  return {
    ...session,
    studentAcademicStatus: student.academicStatus,
    graduatedStudentAccessAllowed: student.graduatedAccessAllowed,
  };
}

/** JWT-only session for high-frequency chatty endpoints (heartbeat, unread-count). */
export async function getLightSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const authorization = req.headers.get('authorization');
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) return verifyAccessToken(bearerToken);
  return getSessionEdge(req.cookies);
}

export async function revokeAllSessions(role: UserRole, userId: number) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(refreshTokens.userRole, role),
      eq(refreshTokens.userId, userId),
      isNull(refreshTokens.revokedAt),
    ));
}

export async function revokeRefreshToken(refreshToken: string) {
  if (!REFRESH_TOKEN_PATTERN.test(refreshToken)) return;
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
