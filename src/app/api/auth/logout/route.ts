import { NextResponse } from 'next/server';
import { clearAuthCookies, getSession, revokeAllSessions } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  
  if (session) {
    await revokeAllSessions(session.role, session.userId);
  }
  
  await clearAuthCookies();
  return NextResponse.json({ message: 'Logged out successfully' });
}
