import { NextResponse, userAgent } from 'next/server';
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
  const hostname = request.headers.get('host') || '';

  let rewritePath: string | null = null;
  const isStaticOrApi = path.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)$/i) || path.startsWith('/api');
  const isAuthPath = path === '/login' || path === '/institution-login' || path === '/employee-login' || path === '/login/super-admin' || path === '/force-password-change';

  if (!isStaticOrApi) {
    if (hostname === 'blog.nisaab360.app' || hostname.startsWith('blog.localhost')) {
      rewritePath = `/blog${path === '/' ? '' : path}`;
    } else if (hostname === 'student.nisaab360.app' || hostname.startsWith('student.localhost')) {
      if (!isAuthPath && !path.startsWith('/student')) rewritePath = `/student${path === '/' ? '' : path}`;
    } else if (hostname === 'staff.nisaab360.app' || hostname.startsWith('staff.localhost')) {
      if (!isAuthPath && !path.startsWith('/staff')) rewritePath = `/staff${path === '/' ? '' : path}`;
    } else if (hostname === 'institution.nisaab360.app' || hostname.startsWith('institution.localhost')) {
      if (!isAuthPath && !path.startsWith('/institution')) rewritePath = `/institution${path === '/' ? '' : path}`;
    } else if (hostname === 'employee.nisaab360.app' || hostname.startsWith('employee.localhost')) {
      if (!isAuthPath && !path.startsWith('/employee')) rewritePath = `/employee${path === '/' ? '' : path}`;
    } else if (hostname === 'sa.nisaab360.app' || hostname === 'superadmin.nisaab360.app' || hostname.startsWith('sa.localhost')) {
      if (!isAuthPath && !path.startsWith('/sa')) rewritePath = `/sa${path === '/' ? '' : path}`;
    }
  }

  const virtualPath = rewritePath || path;

  // Redirect Android mobile users to app download page
  if (virtualPath !== '/download-app') {
    const androidPaths = virtualPath === '/' || virtualPath === '/login' || virtualPath.startsWith('/student') || virtualPath.startsWith('/staff');
    if (androidPaths) {
      const { device, os } = userAgent(request);
      if (device.type === 'mobile' && os.name === 'Android') {
        return NextResponse.redirect(new URL('/download-app', request.url));
      }
    }
  }

  if (
    session &&
    !session.mustChangePassword &&
    (virtualPath === '/' ||
      virtualPath === '/login' ||
      virtualPath === '/institution-login' ||
      virtualPath === '/employee-login' ||
      virtualPath === '/login/super-admin')
  ) {
    return keepWebSessionAlive(
      NextResponse.redirect(new URL(getDashboardPath(session.role, request), request.url)),
      request
    );
  }

  // Protect force-password-change path
  if (virtualPath === '/force-password-change') {
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
    if (!session.mustChangePassword) {
      return keepWebSessionAlive(
        NextResponse.redirect(new URL(getDashboardPath(session.role, request), request.url)),
        request
      );
    }
    const res = rewritePath ? NextResponse.rewrite(new URL(rewritePath, request.url)) : NextResponse.next();
    return keepWebSessionAlive(res, request);
  }

  // Handle password change requirement globally
  if (session && session.mustChangePassword && !virtualPath.startsWith('/api/auth/change-password')) {
    return keepWebSessionAlive(
      NextResponse.redirect(new URL('/force-password-change', request.url)),
      request
    );
  }

  if (virtualPath.startsWith('/sa')) {
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/login/super-admin', request.url));
    }
  }

  if (virtualPath === '/employee' || virtualPath.startsWith('/employee/')) {
    if (!session || session.role !== 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/employee-login', request.url));
    }
  }

  if (virtualPath === '/institution' || virtualPath.startsWith('/institution/')) {
    if (!session || (session.role !== 'INSTITUTION' && session.role !== 'INSTITUTION_ADMIN')) {
      return NextResponse.redirect(new URL('/institution-login', request.url));
    }
    if (session.role === 'INSTITUTION_ADMIN' && (virtualPath === '/institution/admins' || virtualPath === '/institution/settings')) {
      return NextResponse.redirect(new URL('/institution/dashboard', request.url));
    }
  }

  if (virtualPath.startsWith('/staff')) {
    if (!session || session.role !== 'STAFF') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (virtualPath.startsWith('/student')) {
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (session) {
    requestHeaders.set('x-user-session', JSON.stringify(session));
  }
  
  const nextRes = rewritePath 
    ? NextResponse.rewrite(new URL(rewritePath, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  if (session) {
    nextRes.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    nextRes.headers.set('Pragma', 'no-cache');
    nextRes.headers.set('Expires', '0');
  }

  return session ? keepWebSessionAlive(nextRes, request) : nextRes;
}

function getDashboardPath(role: string, request: NextRequest) {
  const host = request.headers.get('host') || 'nisaab360.app';
  const isLocal = host.includes('localhost');
  const protocol = isLocal ? 'http://' : 'https://';
  const baseHost = isLocal ? 'localhost:3000' : 'nisaab360.app';
  
  switch (role) {
    case 'SUPER_ADMIN': return `${protocol}sa.${baseHost}/dashboard`;
    case 'EMPLOYEE': return `${protocol}employee.${baseHost}/dashboard`;
    case 'INSTITUTION':
    case 'INSTITUTION_ADMIN': return `${protocol}institution.${baseHost}/dashboard`;
    case 'STAFF': return `${protocol}staff.${baseHost}/dashboard`;
    case 'STUDENT': return `${protocol}student.${baseHost}/dashboard`;
    default: return '/login';
  }
}

function keepWebSessionAlive(response: NextResponse, request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const secure = process.env.NODE_ENV === 'production';
  const domain = process.env.NODE_ENV === 'production' ? '.nisaab360.app' : undefined;

  if (accessToken) {
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: WEB_SESSION_MAX_AGE,
      domain,
    });
  }

  if (refreshToken) {
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: WEB_SESSION_MAX_AGE,
      domain,
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
