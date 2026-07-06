import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionEdge } from './lib/auth-edge';

export async function middleware(request: NextRequest) {
  const session = await getSessionEdge(request.cookies);
  const path = request.nextUrl.pathname;

  // Protect force-password-change path
  if (path === '/force-password-change') {
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    if (!session.mustChangePassword) {
      // Redirect to their dashboard if they don't need to change it
      return NextResponse.redirect(new URL(getDashboardPath(session.role), request.url));
    }
    return NextResponse.next();
  }

  // Handle password change requirement globally
  if (session && session.mustChangePassword && !path.startsWith('/api/auth/change-password')) {
    return NextResponse.redirect(new URL('/force-password-change', request.url));
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

  return NextResponse.next();
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

export const config = {
  matcher: [
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
