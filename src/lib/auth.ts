import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
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
  
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });

  // Non-HttpOnly cookie for client-side session expiration tracking
  cookieStore.set('session_exp', (Date.now() + WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toString(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  cookieStore.delete('session_exp');
}

export async function getSession(): Promise<JWTPayload | null> {
  let session: JWTPayload | null = null;
  const { headers } = await import('next/headers');
  const headersList = await headers();
  const sessionHeader = headersList.get('x-user-session');
  
  if (sessionHeader) {
    try {
      session = JSON.parse(sessionHeader) as JWTPayload;
    } catch {
      // fallback
    }
  }

  if (!session) {
    const cookieStore = await cookies();
    session = await getSessionEdge(cookieStore);
  }

  if (session) {
    const { verifyUserExists } = await import('./user');
    const exists = await verifyUserExists(session.role, session.userId);
    if (!exists) return null;
  }

  return session;
}

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
  }

  return session;
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
