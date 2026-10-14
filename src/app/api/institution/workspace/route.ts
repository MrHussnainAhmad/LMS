import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { institutions, institutionOwners } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { canManageCampuses, listInstitutionCampuses } from '@/lib/campus-workspaces';
import { getPricingPlan } from '@/lib/pricing';
import { redis } from '@/lib/redis';
import { validationError } from '@/lib/validation-errors';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (_req, { session }) => {
  const institutionId = getTenantContext(session);
  const [campuses, owners, profiles, roots] = await Promise.all([
    listInstitutionCampuses(session),
    db.select({ id: institutionOwners.id }).from(institutionOwners).where(eq(institutionOwners.institutionId, institutionId)).limit(1),
    db.select({ parentId: institutions.parentInstitutionId, registrationNumber: institutions.registrationNumber }).from(institutions).where(eq(institutions.id, institutionId)).limit(1),
    db.select({ pricingPlan: institutions.pricingPlan }).from(institutions).where(eq(institutions.id, session.rootInstitutionId ?? institutionId)).limit(1),
  ]);
  const plan = getPricingPlan(roots[0]?.pricingPlan) ?? getPricingPlan('BASIC')!;
  return NextResponse.json({ institutionId, homeInstitutionId: session.homeInstitutionId, campusId: session.campusId, campusName: session.campusName,
    role: session.role, readOnly: Boolean(session.campusReadOnly), isMainCampus: profiles[0]?.parentId === null,
    registrationNumber: profiles[0]?.registrationNumber, needsOwner: session.role === 'INSTITUTION' && !session.campusReadOnly && !owners.length,
    campuses, plan, canManageCampuses: canManageCampuses(session) && plan.id !== 'ENTERPRISE',
  }, { headers: { 'Cache-Control': 'no-store' } });
});

const ownerSchema = z.object({ name: z.string().trim().min(1).max(255), gender: z.enum(['MALE', 'FEMALE', 'OTHER']), email: z.email().max(255), contactNumber: z.string().trim().min(1).max(50) }).strict();
export const POST = requireRole(['INSTITUTION'], async (req, { session }) => {
  const parsed = ownerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const institutionId = getTenantContext(session);
  const created = await db.transaction(async tx => {
    await tx.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, institutionId)).for('update');
    const [existing] = await tx.select({ id: institutionOwners.id }).from(institutionOwners).where(eq(institutionOwners.institutionId, institutionId)).limit(1);
    if (existing) return false;
    await tx.insert(institutionOwners).values({ institutionId, ...parsed.data });
    return true;
  });
  if (!created) return NextResponse.json({ error: 'Owner details have already been submitted' }, { status: 409 });
  if (redis.status === 'ready') await redis.del(`cache:institution:owner-exists:${institutionId}`);
  return NextResponse.json({ success: true }, { status: 201 });
}, { permission: 'institution.security' });
