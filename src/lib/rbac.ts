import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, UserRole, JWTPayload } from './auth';

type RouteHandler = (
  req: NextRequest,
  context: { params: any; session: JWTPayload },
) => Promise<NextResponse> | NextResponse;

export function requireRole(
  allowedRoles: UserRole[],
  handler: RouteHandler,
  options?: { allowPasswordChangeRequired?: boolean }
) {
  return async (req: NextRequest, context: any) => {
    try {
      const session = await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!allowedRoles.includes(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (session.mustChangePassword && !options?.allowPasswordChangeRequired) {
        return NextResponse.json(
          { error: 'PASSWORD_CHANGE_REQUIRED' },
          { status: 403 }
        );
      }

      // Add session to context for the handler
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
