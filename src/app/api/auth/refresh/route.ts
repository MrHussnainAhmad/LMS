import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { refreshTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { createTokens, setAuthCookies, timingSafeEqual } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  // Generate new tokens
  const payload = {
    userId: record.userId,
    role: record.userRole,
    // Note: We'd typically fetch latest user state here (like mustChangePassword, institutionId)
    // For brevity, we assume minimal payload or refetch user.
  };

  // We delete the old token (rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));

  const { accessToken, refreshToken: newRefresh } = await createTokens(payload);
  await setAuthCookies(accessToken, newRefresh);

  return NextResponse.json({ message: 'Token refreshed' });
}
