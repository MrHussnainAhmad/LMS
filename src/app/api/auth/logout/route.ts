import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, revokeRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const refreshToken = typeof body.refreshToken === 'string'
    ? body.refreshToken
    : req.cookies.get('refresh_token')?.value;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  await clearAuthCookies();
  return NextResponse.json({ message: 'Logged out successfully' });
}
