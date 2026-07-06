import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { clearAuthCookies, createTokens, revokeAllSessions, setAuthCookies } from '@/lib/auth';
import { cookies } from 'next/headers';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);

  if (!record) {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  if (record.revokedAt) {
    await db.update(refreshTokens)
      .set({ reuseDetectedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));

    await logAudit({
      institutionId: undefined,
      actorId: record.userId,
      actorRole: record.userRole,
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      target: `User:${record.userRole}:${record.userId}`,
      ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
    });

    await revokeAllSessions(record.userRole, record.userId);
    await clearAuthCookies();
    return NextResponse.json({ error: 'Session revoked. Please log in again.' }, { status: 401 });
  }

  if (record.expiresAt < new Date()) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, record.id));
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const payload = {
    userId: record.userId,
    role: record.userRole,
    // Note: We'd typically fetch latest user state here (like mustChangePassword, institutionId)
    // For brevity, we assume minimal payload or refetch user.
  };

  const { accessToken, refreshToken: newRefresh } = await createTokens(payload);
  const newRefreshHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
  await db.update(refreshTokens)
    .set({ revokedAt: new Date(), replacedByHash: newRefreshHash })
    .where(eq(refreshTokens.id, record.id));
  await setAuthCookies(accessToken, newRefresh);

  return NextResponse.json({ message: 'Token refreshed' });
}
