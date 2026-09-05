import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, getLightSessionFromRequest, UserRole, JWTPayload } from './auth';
import { DEFAULT_MAX_BODY_BYTES, bodyTooLargeResponse, exceedsDeclaredBodyLimit } from './http';
import { withRateLimit } from './rate-limit';

type RouteHandler = (
  req: NextRequest,
  context: { params: any; session: JWTPayload },
) => Promise<NextResponse> | NextResponse;

type RequireRoleOptions = {
  allowPasswordChangeRequired?: boolean;
  /** Skip Redis/DB user validity + student enrich — for heartbeat/unread only. */
  light?: boolean;
  /** Override the request-body ceiling for routes with genuinely larger payloads. */
  maxBodyBytes?: number;
};

function enforceSessionGuards(
  req: NextRequest,
  session: JWTPayload,
  allowedRoles: UserRole[],
  options?: RequireRoleOptions,
): NextResponse | null {
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (session.mustChangePassword && !options?.allowPasswordChangeRequired) {
    return NextResponse.json(
      { error: 'PASSWORD_CHANGE_REQUIRED' },
      { status: 403 }
    );
  }

  if (session.role === 'STUDENT' && session.studentAcademicStatus === 'GRADUATED') {
    const allowedGraduateApiPaths = [
      '/api/student/profile',
      '/api/student/transcripts',
      '/api/student/attendance',
      '/api/student/dashboard',
      '/api/student/promotion-result',
    ];
    const isAllowedGraduateApi = allowedGraduateApiPaths.some((path) => (
      req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(`${path}/`)
    ));
    if (!isAllowedGraduateApi) {
      return NextResponse.json({ error: 'Graduate access is limited to profile, transcripts, and attendance.' }, { status: 403 });
    }
  }

  return null;
}

export function requireRole(
  allowedRoles: UserRole[],
  handler: RouteHandler,
  options?: RequireRoleOptions
) {
  return async (req: NextRequest, context: any) => {
    try {
      // Cheapest possible rejection: refuse an oversized body before spending any
      // work on it. Covers every requireRole-wrapped handler without touching them.
      if (exceedsDeclaredBodyLimit(req, options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)) {
        return bodyTooLargeResponse();
      }

      const session = options?.light
        ? await getLightSessionFromRequest(req)
        : await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const guard = enforceSessionGuards(req, session, allowedRoles, options);
      if (guard) return guard;

      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const limited = await withRateLimit(req, 'api', `${session.role}:${session.userId}`);
        if (!limited.success) {
          return NextResponse.json(
            { error: 'Too many requests. Please wait and try again.' },
            { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
          );
        }
      }

      const enhancedContext = { ...context, session };
      return await handler(req, enhancedContext as any);
    } catch (err) {
      console.error('RBAC Error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export function getTenantContext(session: JWTPayload): number {
  if (!session.institutionId) {
    throw new Error('Tenant context missing. This route requires an institution ID.');
  }
  return session.institutionId;
}
