import type { NextRequest } from 'next/server';
import type { JWTPayload } from './auth-types';

export function unsafeOrigin(req: Pick<NextRequest, 'method' | 'headers'>): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return false;
  // Explicit bearer credentials are not ambient browser authority (cookies are ignored).
  if (/^Bearer\s+\S+/i.test(req.headers.get('authorization') || '')) return false;
  // Provider callbacks authenticate their payload independently, not by cookies.
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') === 'cross-site';
  try {
    const parsed = new URL(origin);
    const host = req.headers.get('host');
    return parsed.host !== host || (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname)));
  } catch { return true; }
}

export function sessionRestriction(session: JWTPayload, path: string): string | null {
  if (['/api/auth/change-password', '/api/auth/logout', '/api/auth/refresh'].includes(path)) return null;
  if (session.mustChangePassword) return 'PASSWORD_CHANGE_REQUIRED';
  if (session.role === 'STUDENT' && session.studentAcademicStatus === 'GRADUATED') {
    const allowed = ['/api/student/profile','/api/student/transcripts','/api/student/attendance','/api/student/dashboard','/api/student/promotion-result'];
    if (!allowed.some(base => path === base || path.startsWith(base + '/'))) return 'Graduate access is restricted.';
  }
  return null;
}
