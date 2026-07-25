import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { db } from '@/db';
import { institutions, refreshTokens, students } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { UserRole, JWTPayload } from './auth-types';
import { verifyAccessToken, getSessionEdge } from './auth-edge';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-12345');

export { verifyAccessToken };
export type { UserRole, JWTPayload };

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const WEB_SESSION_EXPIRY_DAYS = 5;
const ACCESS_TOKEN_EXPIRY = `${WEB_SESSION_EXPIRY_DAYS}d`;

async function getCookieScope() {
  const { headers } = await import('next/headers');
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
    .sign(JWT_SECRET);
}

export async function createTokens(payload: JWTPayload) {
  const accessToken = await createAccessToken(payload);
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(refreshTokens).values({
    userRole: payload.role,
    userId: payload.userId,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
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
 * When middleware already verified the JWT and set `x-user-session`, trust that
 * payload for read-only page renders (no Redis/DB validity round-trip). API
 * mutations still use getSessionFromRequest → verifyUserExists.
 *
 * Deactivation is enforced within JWT lifetime (5d) plus every mutating API call.
 * Validity cache invalidation still applies to API traffic immediately.
 */
export const getSession = cache(async (): Promise<JWTPayload | null> => {
  let session: JWTPayload | null = null;
  let fromMiddleware = false;
  const { headers } = await import('next/headers');
  const headersList = await headers();
  const sessionHeader = headersList.get('x-user-session');
  
  if (sessionHeader) {
    try {
      session = JSON.parse(sessionHeader) as JWTPayload;
      fromMiddleware = true;
    } catch {
      // fallback
    }
  }

  if (!session) {
    const cookieStore = await cookies();
    session = await getSessionEdge(cookieStore);
  }

  if (!session) return null;

  if (!fromMiddleware) {
    const { verifyUserExists } = await import('./user');
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
    const { verifyUserExists } = await import('./user');
    const exists = await verifyUserExists(session.role, session.userId);
    if (!exists) return null;
    session = await enrichSession(session);
  }

  return session;
}

async function enrichSession(session: JWTPayload): Promise<JWTPayload> {
  if (session.role !== 'STUDENT') return session;
  // Login/refresh already embed these claims — skip the join when present.
  if (session.studentAcademicStatus !== undefined && session.graduatedStudentAccessAllowed !== undefined) {
    return session;
  }

  const [student] = await db.select({
    academicStatus: students.academicStatus,
    graduatedAccessAllowed: institutions.allowGraduatedStudentAccess,
  })
    .from(students)
    .innerJoin(institutions, eq(students.institutionId, institutions.id))
    .where(eq(students.id, session.userId))
    .limit(1);

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
  await db.delete(refreshTokens).where(and(eq(refreshTokens.userRole, role), eq(refreshTokens.userId, userId)));
}

export async function revokeRefreshToken(refreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
