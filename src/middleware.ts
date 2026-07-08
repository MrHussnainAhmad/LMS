import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionEdge } from './lib/auth-edge';
import { applyCorsHeaders, corsPreflight } from './lib/cors';

const WEB_SESSION_MAX_AGE = 5 * 24 * 60 * 60;

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    if (request.method === 'OPTIONS') return corsPreflight(request);
    return applyCorsHeaders(request, NextResponse.next());
  }

  const session = await getSessionEdge(request.cookies);
  const path = request.nextUrl.pathname;

  if (session && !session.mustChangePassword && (path === '/' || path === '/login' || path === '/login/super-admin')) {
    return keepWebSessionAlive(
      NextResponse.redirect(new URL(getDashboardPath(session.role), request.url)),
      request
    );
  }

  // Protect force-password-change path
  if (path === '/force-password-change') {
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    if (!session.mustChangePassword) {
      // Redirect to their dashboard if they don't need to change it
      return keepWebSessionAlive(
        NextResponse.redirect(new URL(getDashboardPath(session.role), request.url)),
        request
      );
    }
    return keepWebSessionAlive(NextResponse.next(), request);
  }

  // Handle password change requirement globally
  if (session && session.mustChangePassword && !path.startsWith('/api/auth/change-password')) {
    return keepWebSessionAlive(
      NextResponse.redirect(new URL('/force-password-change', request.url)),
      request
    );
  }

  if (path.startsWith('/sa')) {
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/login/super-admin', request.url));
    }
  }

  if (path.startsWith('/employee')) {
    if (!session || session.role !== 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (path.startsWith('/institution')) {
    if (!session || session.role !== 'INSTITUTION') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (path.startsWith('/staff')) {
    if (!session || session.role !== 'STAFF') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (path.startsWith('/student')) {
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return session ? keepWebSessionAlive(NextResponse.next(), request) : NextResponse.next();
}

function getDashboardPath(role: string) {
  switch (role) {
    case 'SUPER_ADMIN': return '/sa/dashboard';
    case 'EMPLOYEE': return '/employee/dashboard';
    case 'INSTITUTION': return '/institution/dashboard';
    case 'STAFF': return '/staff/dashboard';
    case 'STUDENT': return '/student/dashboard';
    default: return '/login';
  }
}

function keepWebSessionAlive(response: NextResponse, request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const secure = process.env.NODE_ENV === 'production';

  if (accessToken) {
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: WEB_SESSION_MAX_AGE,
    });
  }

  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: WEB_SESSION_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes are protected by rbac.ts)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
