import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, getSessionFromRequest, revokeAllSessions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  
  if (session) {
    await revokeAllSessions(session.role, session.userId);
  }
  
  await clearAuthCookies();
  return NextResponse.json({ message: 'Logged out successfully' });
}
