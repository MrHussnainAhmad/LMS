import { NextResponse } from 'next/server';
import { and, asc, eq, gt, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { institutions, pricingPlanChanges, pricingNoticeReads } from '@/db/schema';
import { requireRole } from '@/lib/rbac';
import { readJsonBody } from '@/lib/http';

const headers = { 'Cache-Control': 'private, no-store' };
export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (_req, { session }) => {
  const [read] = await db.select().from(pricingNoticeReads).where(and(eq(pricingNoticeReads.userRole, session.role), eq(pricingNoticeReads.userId, session.userId))).limit(1);
  const [institution] = await db.select({ createdAt: institutions.createdAt }).from(institutions).where(eq(institutions.id, session.homeInstitutionId ?? session.institutionId!)).limit(1);
  if (!institution) return NextResponse.json({ changes: [] }, { headers });
  const changes = await db.select({ id: pricingPlanChanges.id, before: pricingPlanChanges.before, after: pricingPlanChanges.after, createdAt: pricingPlanChanges.createdAt }).from(pricingPlanChanges)
    .where(and(gt(pricingPlanChanges.id, read?.lastChangeId ?? 0), gte(pricingPlanChanges.createdAt, institution.createdAt)))
    .orderBy(asc(pricingPlanChanges.id)).limit(20);
  return NextResponse.json({ changes }, { headers });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req, { session }) => {
  const body = await readJsonBody(req, 1024);
  const parsed = z.object({ through: z.number().int().positive() }).strict().safeParse(body.ok ? body.data : null);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid notice.' }, { status: 400, headers });
  const [change] = await db.select({ id: pricingPlanChanges.id }).from(pricingPlanChanges).where(eq(pricingPlanChanges.id, parsed.data.through)).limit(1);
  if (!change) return NextResponse.json({ error: 'Notice not found.' }, { status: 404, headers });
  await db.insert(pricingNoticeReads).values({ userRole: session.role, userId: session.userId, lastChangeId: change.id }).onConflictDoUpdate({
    target: [pricingNoticeReads.userRole, pricingNoticeReads.userId],
    set: { lastChangeId: sql`greatest(${pricingNoticeReads.lastChangeId},${change.id})` },
  });
  return NextResponse.json({ success: true }, { headers });
});
