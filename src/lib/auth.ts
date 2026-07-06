import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { UserRole, JWTPayload } from './auth-types';
import { verifyAccessToken, getSessionEdge } from './auth-edge';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-12345');

export { verifyAccessToken };
export type { UserRole, JWTPayload };

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export async function createTokens(payload: JWTPayload) {
  const accessToken = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

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
    maxAge: 15 * 60, // 15 mins
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  return await getSessionEdge(cookieStore);
}

export async function revokeAllSessions(role: UserRole, userId: number) {
  await db.delete(refreshTokens).where(
    and(
      eq(refreshTokens.userRole, role),
      eq(refreshTokens.userId, userId)
    )
  );
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
