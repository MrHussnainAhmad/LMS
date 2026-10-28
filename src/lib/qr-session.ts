import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { qrLoginSessions, refreshTokens } from '@/db/schema';
import type { JWTPayload } from './auth-types';

/** Signature caching must never cache this revocation decision. */
export async function isQrSessionActive(payload: JWTPayload): Promise<boolean> {
  if (!payload.qrSessionId) return true;
  if (!['STUDENT', 'STAFF'].includes(payload.role) || !payload.institutionId ||
      !payload.qrSessionExpiresAt || payload.qrSessionExpiresAt * 1000 <= Date.now()) return false;
  const [row] = await db.select({ id: qrLoginSessions.id }).from(qrLoginSessions).where(and(
    eq(qrLoginSessions.id, payload.qrSessionId), eq(qrLoginSessions.userRole, payload.role),
    eq(qrLoginSessions.userId, payload.userId), eq(qrLoginSessions.institutionId, payload.institutionId),
    isNull(qrLoginSessions.revokedAt), gt(qrLoginSessions.expiresAt, sql`clock_timestamp()`),
    sql`EXISTS (SELECT 1 FROM ${refreshTokens} WHERE ${refreshTokens.qrSessionId}=${qrLoginSessions.id}
      AND ${refreshTokens.revokedAt} IS NULL AND ${refreshTokens.expiresAt}>clock_timestamp())`,
  )).limit(1);
  return Boolean(row);
}
