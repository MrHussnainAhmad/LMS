import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { admissionApplications, admissionCycles, admissionOfferings, institutions } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { admissionConfigurationActionSchema } from '@/lib/validators/admissions';
import { invalidateInstitutionTenantCache } from '@/lib/institution-tenant';
import { logAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (_req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const [cycles, offerings] = await Promise.all([
    db.select().from(admissionCycles).where(eq(admissionCycles.institutionId, institutionId)).orderBy(desc(admissionCycles.createdAt)),
    db.select().from(admissionOfferings).where(eq(admissionOfferings.institutionId, institutionId)).orderBy(desc(admissionOfferings.createdAt)),
  ]);
  return NextResponse.json({ cycles, offerings });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = admissionConfigurationActionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.length ? ` (${issue.path.join('.')})` : '';
    return NextResponse.json({ error: `${issue?.message || 'Invalid admissions settings'}${field}` }, { status: 400 });
  }
  const action = parsed.data;

  try {
    if (action.action === 'createCycle') {
      const [cycle] = await db.insert(admissionCycles).values({
        institutionId,
        name: action.name,
        academicYear: action.academicYear,
        opensOn: action.opensOn,
        closesOn: action.closesOn,
        instructions: action.instructions,
        requiredDocuments: action.requiredDocuments,
        requiresTest: action.requiresTest,
        testScheduledAt: action.testScheduledAt ? new Date(action.testScheduledAt) : null,
        testLocation: action.testLocation,
        testInstructions: action.testInstructions,
        requiresInterview: action.requiresInterview,
        interviewScheduledAt: action.interviewScheduledAt ? new Date(action.interviewScheduledAt) : null,
        interviewLocation: action.interviewLocation,
        interviewInstructions: action.interviewInstructions,
        admissionFeeAmount: action.admissionFeeAmount,
        admissionFeeDueDays: action.admissionFeeDueDays,
        admissionFeeInstructions: action.admissionFeeInstructions,
        paymentMethods: action.paymentMethods,
        paymentBankName: action.paymentMethods[0]?.providerName || null,
        paymentAccountNumber: action.paymentMethods[0]?.accountNumber || null,
        paymentQrUrl: action.paymentMethods[0]?.qrUrl || null,
      }).returning();
      await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'CREATE_ADMISSION_CYCLE', target: `Admission cycle ${cycle.id}`, ip: getClientIp(req) });
      return NextResponse.json({ cycle }, { status: 201 });
    }

    if (action.action === 'updateCycle') {
      const [existing] = await db.select({ id: admissionCycles.id, status: admissionCycles.status }).from(admissionCycles).where(and(
        eq(admissionCycles.id, action.cycleId),
        eq(admissionCycles.institutionId, institutionId),
      )).limit(1);
      if (!existing) return NextResponse.json({ error: 'Admission cycle not found' }, { status: 404 });
      if (existing.status === 'OPEN') return NextResponse.json({ error: 'Close this admission cycle before editing it' }, { status: 409 });

      const [cycle] = await db.update(admissionCycles).set({
        name: action.name,
        academicYear: action.academicYear,
        opensOn: action.opensOn,
        closesOn: action.closesOn,
        instructions: action.instructions,
        requiredDocuments: action.requiredDocuments,
        requiresTest: action.requiresTest,
        testScheduledAt: action.testScheduledAt ? new Date(action.testScheduledAt) : null,
        testLocation: action.testLocation,
        testInstructions: action.testInstructions,
        requiresInterview: action.requiresInterview,
        interviewScheduledAt: action.interviewScheduledAt ? new Date(action.interviewScheduledAt) : null,
        interviewLocation: action.interviewLocation,
        interviewInstructions: action.interviewInstructions,
        admissionFeeAmount: action.admissionFeeAmount,
        admissionFeeDueDays: action.admissionFeeDueDays,
        admissionFeeInstructions: action.admissionFeeInstructions,
        paymentMethods: action.paymentMethods,
        paymentBankName: action.paymentMethods[0]?.providerName || null,
        paymentAccountNumber: action.paymentMethods[0]?.accountNumber || null,
        paymentQrUrl: action.paymentMethods[0]?.qrUrl || null,
        updatedAt: new Date(),
      }).where(and(
        eq(admissionCycles.id, existing.id),
        eq(admissionCycles.institutionId, institutionId),
      )).returning();
      const [institution] = await db.select({ publicSlug: institutions.publicSlug }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
      if (institution?.publicSlug) await invalidateInstitutionTenantCache(institution.publicSlug);
      await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'UPDATE_ADMISSION_CYCLE', target: `Admission cycle ${cycle.id}`, ip: getClientIp(req) });
      return NextResponse.json({ cycle });
    }

    if (action.action === 'createOffering') {
      const [cycle] = await db.select({ id: admissionCycles.id }).from(admissionCycles).where(and(
        eq(admissionCycles.id, action.cycleId),
        eq(admissionCycles.institutionId, institutionId),
      )).limit(1);
      if (!cycle) return NextResponse.json({ error: 'Admission cycle not found' }, { status: 404 });

      const [offering] = await db.insert(admissionOfferings).values({
        institutionId,
        cycleId: action.cycleId,
        title: action.title,
        description: action.description,
        capacity: action.capacity,
      }).returning();
      await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'CREATE_ADMISSION_OFFERING', target: `Admission offering ${offering.id}`, ip: getClientIp(req) });
      return NextResponse.json({ offering }, { status: 201 });
    }

    if (action.action === 'updateOffering' || action.action === 'deleteOffering') {
      const [offering] = await db.select({ id: admissionOfferings.id, cycleId: admissionOfferings.cycleId }).from(admissionOfferings).where(and(
        eq(admissionOfferings.id, action.offeringId),
        eq(admissionOfferings.institutionId, institutionId),
      )).limit(1);
      if (!offering) return NextResponse.json({ error: 'Admission program or class not found' }, { status: 404 });
      const [cycle] = await db.select({ status: admissionCycles.status }).from(admissionCycles).where(and(
        eq(admissionCycles.id, offering.cycleId),
        eq(admissionCycles.institutionId, institutionId),
      )).limit(1);
      if (!cycle) return NextResponse.json({ error: 'Admission cycle not found' }, { status: 404 });
      if (cycle.status === 'OPEN') return NextResponse.json({ error: 'Close this admission cycle before editing or removing its programs and classes' }, { status: 409 });

      if (action.action === 'updateOffering') {
        const [updated] = await db.update(admissionOfferings).set({
          title: action.title,
          description: action.description,
          capacity: action.capacity,
        }).where(and(
          eq(admissionOfferings.id, offering.id),
          eq(admissionOfferings.institutionId, institutionId),
        )).returning();
        await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'UPDATE_ADMISSION_OFFERING', target: `Admission offering ${offering.id}`, ip: getClientIp(req) });
        return NextResponse.json({ offering: updated });
      }

      const [applicationCount] = await db.select({ value: count() }).from(admissionApplications).where(and(
        eq(admissionApplications.offeringId, offering.id),
        eq(admissionApplications.institutionId, institutionId),
      ));
      if ((applicationCount?.value || 0) > 0) return NextResponse.json({ error: 'This program or class has application records, so it cannot be deleted' }, { status: 409 });
      await db.delete(admissionOfferings).where(and(
        eq(admissionOfferings.id, offering.id),
        eq(admissionOfferings.institutionId, institutionId),
      ));
      await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'DELETE_ADMISSION_OFFERING', target: `Admission offering ${offering.id}`, ip: getClientIp(req) });
      return NextResponse.json({ success: true });
    }

    if (action.action === 'deleteCycle') {
      const [[cycle], [applicationCount]] = await Promise.all([
        db.select({ id: admissionCycles.id, status: admissionCycles.status }).from(admissionCycles).where(and(
          eq(admissionCycles.id, action.cycleId),
          eq(admissionCycles.institutionId, institutionId),
        )).limit(1),
        db.select({ value: count() }).from(admissionApplications).where(and(
          eq(admissionApplications.cycleId, action.cycleId),
          eq(admissionApplications.institutionId, institutionId),
        )),
      ]);
      if (!cycle) return NextResponse.json({ error: 'Admission cycle not found' }, { status: 404 });
      if (cycle.status === 'OPEN') return NextResponse.json({ error: 'Close this admission cycle before removing it' }, { status: 409 });
      if ((applicationCount?.value || 0) > 0) return NextResponse.json({ error: 'This cycle has application records, so it cannot be deleted. Keep it closed to preserve the admission history.' }, { status: 409 });
      await db.delete(admissionCycles).where(and(
        eq(admissionCycles.id, cycle.id),
        eq(admissionCycles.institutionId, institutionId),
      ));
      await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: 'DELETE_ADMISSION_CYCLE', target: `Admission cycle ${cycle.id}`, ip: getClientIp(req) });
      return NextResponse.json({ success: true });
    }

    const [cycle] = await db.select({ id: admissionCycles.id, status: admissionCycles.status }).from(admissionCycles).where(and(
      eq(admissionCycles.id, action.cycleId),
      eq(admissionCycles.institutionId, institutionId),
    )).limit(1);
    if (!cycle) return NextResponse.json({ error: 'Admission cycle not found' }, { status: 404 });

    const [institution] = await db.select({
      publicSlug: institutions.publicSlug,
      publicSiteEnabled: institutions.publicSiteEnabled,
    }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);

    if (action.status === 'OPEN') {
      if (!institution?.publicSlug || !institution.publicSiteEnabled) {
        return NextResponse.json({ error: 'Publish the institution website before opening admissions' }, { status: 409 });
      }
      const [offering] = await db.select({ id: admissionOfferings.id }).from(admissionOfferings).where(and(
        eq(admissionOfferings.cycleId, cycle.id),
        eq(admissionOfferings.institutionId, institutionId),
        eq(admissionOfferings.isActive, true),
      )).limit(1);
      if (!offering) return NextResponse.json({ error: 'Add at least one offering before opening admissions' }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      if (action.status === 'OPEN') {
        await tx.update(admissionCycles).set({ status: 'CLOSED', updatedAt: new Date() }).where(and(
          eq(admissionCycles.institutionId, institutionId),
          eq(admissionCycles.status, 'OPEN'),
        ));
      }
      await tx.update(admissionCycles).set({ status: action.status, updatedAt: new Date() }).where(and(
        eq(admissionCycles.id, cycle.id),
        eq(admissionCycles.institutionId, institutionId),
      ));
      if (action.status === 'OPEN' || cycle.status === 'OPEN') {
        await tx.update(institutions).set({ admissionsEnabled: action.status === 'OPEN' }).where(eq(institutions.id, institutionId));
      }
    });

    if (institution?.publicSlug) await invalidateInstitutionTenantCache(institution.publicSlug);
    await logAudit({ institutionId, actorId: session.userId, actorRole: session.role, action: `SET_ADMISSION_CYCLE_${action.status}`, target: `Admission cycle ${cycle.id}`, ip: getClientIp(req) });
    return NextResponse.json({ success: true, status: action.status });
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    const code = databaseError.code || databaseError.cause?.code;
    if (code === '23505') return NextResponse.json({ error: 'A cycle or offering with that name already exists' }, { status: 409 });
    if (code === '23514') return NextResponse.json({ error: 'Admissions dates or capacity are invalid' }, { status: 400 });
    throw error;
  }
});
