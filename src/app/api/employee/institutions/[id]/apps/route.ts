import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { institutions } from '@/db/schema';
import { requireRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';
import { readJsonBody, AUTH_MAX_BODY_BYTES } from '@/lib/http';

const input = z.object({ appsEnabled: z.boolean() }).strict();
// Both platform Admin variants use SUPER_ADMIN; isSuperAdmin distinguishes the
// root security administrator, not ordinary institution-product permissions.
export const PATCH = requireRole(['SUPER_ADMIN', 'EMPLOYEE'], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 });
  // Cookie-authenticated administrative writes must originate on this portal.
  if (!/^Bearer\s+\S+$/i.test(req.headers.get('authorization') || '')) {
    try {
      const origin = new URL(req.headers.get('origin') || '');
      if (origin.host !== (req.headers.get('host') || req.nextUrl.host) || origin.protocol !== `${req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.slice(0, -1)}:` || req.headers.get('sec-fetch-site') === 'cross-site') throw new Error();
    } catch { return NextResponse.json({ error: 'Same-origin request required' }, { status: 403 }); }
  }
  const body = await readJsonBody(req, AUTH_MAX_BODY_BYTES);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = input.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'appsEnabled must be a boolean; no other fields are accepted.' }, { status: 400 });
  const [updated] = await db.update(institutions).set({ appsEnabled: parsed.data.appsEnabled })
    .where(and(eq(institutions.id, Number(id)), isNull(institutions.deletedAt)))
    .returning({ id: institutions.id, appsEnabled: institutions.appsEnabled });
  if (!updated) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
  await logAudit({ actorId: session.userId, actorRole: session.role, institutionId: updated.id,
    action: updated.appsEnabled ? 'ENABLE_INSTITUTION_APPS' : 'DISABLE_INSTITUTION_APPS', target: `Institution ${updated.id}`, ip: getClientIp(req) });
  return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } });
});
