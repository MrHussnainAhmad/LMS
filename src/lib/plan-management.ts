import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq, isNull, sql, asc } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptionPlans, dealtPlanCodes, dealtCodeFingerprints, pricingPlanChanges, planDeviceSessions } from '@/db/schema';
import { displayPlan, type PricingPlan } from './plan-types';
import { getJwtSecret } from './jwt-secret';

export class PlanError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type PlanExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;
const capacity = z.number().int().min(1).max(1_000_000).nullable();
const money = z.number().int().min(0).max(2_000_000_000).nullable();
export const managedPlanSchema = z.object({
  kind: z.enum(['PUBLIC', 'DEAL']), name: z.string().trim().min(2).max(120),
  monthlyFeePaisa: money, setupFeePaisa: money, perStudentFeePaisa: money,
  studentLimit: capacity, studentCount: capacity, campusLimit: capacity,
  platforms: z.array(z.string().trim().min(1).max(80)).min(1).max(20).transform(values => [...new Set(values)]),
  deviceLimit: capacity, platformManagedCampuses: z.boolean().default(false),
  audience: z.string().trim().max(160).default(''), featured: z.boolean().default(false),
  revision: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'PUBLIC' && value.monthlyFeePaisa === null && value.perStudentFeePaisa === null) ctx.addIssue({ code: 'custom', path: ['monthlyFeePaisa'], message: 'Enter a monthly fee or a starting per-student rate.' });
  if (value.kind === 'DEAL') {
    if (!value.studentLimit || !value.studentCount || value.perStudentFeePaisa === null || !value.deviceLimit) ctx.addIssue({ code: 'custom', message: 'Dealed plans require a student allowance, billed student count, per-student rate and device allowance.' });
    if (value.studentCount && value.studentLimit && value.studentCount > value.studentLimit) ctx.addIssue({ code: 'custom', path: ['studentCount'], message: 'Billed students cannot exceed the student allowance.' });
    if ((value.perStudentFeePaisa ?? 0) * (value.studentCount ?? 0) > 2_000_000_000) ctx.addIssue({ code: 'custom', message: 'The calculated monthly fee is too large.' });
  }
});
export type ManagedPlanInput = z.input<typeof managedPlanSchema>;

export async function saveManagedPlan(input: unknown, actorId: number, id?: string) {
  const parsed = managedPlanSchema.safeParse(input);
  if (!parsed.success) throw new PlanError(parsed.error.issues.map(issue => issue.message).join(' '));
  const { revision, ...data } = parsed.data;
  if (data.kind === 'DEAL') { data.monthlyFeePaisa = data.perStudentFeePaisa! * data.studentCount!; data.setupFeePaisa = 0; data.featured = false; }
  else data.studentCount = null;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pricing-catalog'))`);
    const [previous] = id ? await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).for('update').limit(1) : [];
    if (id && (!previous || previous.archivedAt)) throw new PlanError('This plan is no longer available.', 404);
    if (previous && (previous.kind !== data.kind || previous.redeemedAt)) throw new PlanError('A redeemed deal cannot be edited, and plan types cannot be changed.', 409);
    if (previous && revision !== previous.revision) throw new PlanError('Another admin changed this plan. Reload and try again.', 409);
    if (previous && Object.entries(data).every(([key, value]) => JSON.stringify(value) === JSON.stringify(previous[key as keyof typeof data]))) return displayPlan(previous);
    const planId = previous?.id ?? `${data.kind === 'DEAL' ? 'D' : 'P'}_${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    const values = { ...data, revision: (previous?.revision ?? 0) + 1, updatedAt: new Date() };
    const [saved] = previous
      ? await tx.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, planId)).returning()
      : await tx.insert(subscriptionPlans).values({ ...values, id: planId, createdBy: actorId }).returning();
    if (saved.kind === 'PUBLIC') await tx.insert(pricingPlanChanges).values({ planId, before: previous ? displayPlan(previous) : null, after: displayPlan(saved), createdBy: actorId });
    else await tx.delete(dealtPlanCodes).where(and(eq(dealtPlanCodes.planId, planId), isNull(dealtPlanCodes.usedAt)));
    return displayPlan(saved);
  });
}

export async function removeManagedPlan(id: string, actorId: number) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('pricing-catalog'))`);
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).for('update').limit(1);
    if (!plan || plan.archivedAt) throw new PlanError('Plan not found.', 404);
    await tx.update(subscriptionPlans).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(subscriptionPlans.id, id));
    await tx.delete(dealtPlanCodes).where(and(eq(dealtPlanCodes.planId, id), isNull(dealtPlanCodes.usedAt)));
    if (plan.kind === 'PUBLIC') await tx.insert(pricingPlanChanges).values({ planId: id, before: displayPlan(plan), after: null, createdBy: actorId });
  });
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;
export function dealCodeHash(code: string) { return createHmac('sha256', getJwtSecret()).update(`dealed:${code}`).digest('hex'); }

export async function pruneExpiredDealtPlanCodes() {
  const removed = await db.delete(dealtPlanCodes).where(and(isNull(dealtPlanCodes.usedAt), sql`${dealtPlanCodes.expiresAt} <= now()`)).returning({ hash: dealtPlanCodes.codeHash });
  await db.delete(planDeviceSessions).where(sql`${planDeviceSessions.expiresAt} < now()-interval '30 days'`);
  return { deleted: removed.length };
}

export async function generateDealtCode(planId: string) {
  return db.transaction(async tx => {
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).for('update').limit(1);
    if (!plan || plan.kind !== 'DEAL' || plan.archivedAt || plan.redeemedAt) throw new PlanError('Only an unused Dealed plan can generate a code.', 409);
    await tx.delete(dealtPlanCodes).where(and(eq(dealtPlanCodes.planId, planId), isNull(dealtPlanCodes.usedAt)));
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const hash = dealCodeHash(code);
      const unique = await tx.insert(dealtCodeFingerprints).values({ codeHash: hash }).onConflictDoNothing().returning({ hash: dealtCodeFingerprints.codeHash });
      if (!unique.length) continue;
      await tx.insert(dealtPlanCodes).values({ codeHash: hash, planId, expiresAt });
      return { code, expiresAt: expiresAt.toISOString() };
    }
    throw new PlanError('Could not generate a code. Please try again.', 503);
  });
}

/** Same lock order as regeneration: plan first, then re-read the code. */
export async function resolveDealtPlan(code: string, store: PlanExecutor = db, lock = false): Promise<PricingPlan> {
  if (!DEAL_CODE_PATTERN.test(code)) throw new PlanError('This deal code is invalid or no longer available.');
  const hash = dealCodeHash(code);
  const [initial] = await store.select({ planId: dealtPlanCodes.planId }).from(dealtPlanCodes).where(eq(dealtPlanCodes.codeHash, hash)).limit(1);
  if (!initial) throw new PlanError('This deal code is invalid or no longer available.');
  const query = store.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, initial.planId));
  const [plan] = await (lock ? query.for('update') : query).limit(1);
  const codeQuery = store.select().from(dealtPlanCodes).where(and(eq(dealtPlanCodes.codeHash, hash), isNull(dealtPlanCodes.usedAt), sql`${dealtPlanCodes.expiresAt} > clock_timestamp()`));
  const [current] = await (lock ? codeQuery.for('update') : codeQuery).limit(1);
  if (!current || !plan || plan.kind !== 'DEAL' || plan.archivedAt || plan.redeemedAt) throw new PlanError('This deal code is invalid or no longer available.');
  return displayPlan(plan);
}

export async function registrationPlan(store: PlanExecutor, selection: string, revision: number, code?: string) {
  if (selection === 'DEALED') {
    const plan = await resolveDealtPlan(code ?? '', store, true);
    if (plan.revision !== revision) throw new PlanError('This deal changed. Check the code again before accepting the agreement.', 409);
    return plan;
  }
  const [plan] = await store.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, selection)).for('share').limit(1);
  if (!plan || plan.kind !== 'PUBLIC' || plan.archivedAt) throw new PlanError('Select an available pricing plan.');
  if (plan.revision !== revision) throw new PlanError('This plan changed. Reload registration and review the current pricing.', 409);
  return displayPlan(plan);
}

export async function consumeDealtCode(store: PlanExecutor, plan: PricingPlan, code: string, institutionId: number) {
  const used = await store.update(dealtPlanCodes).set({ usedAt: new Date() }).where(and(eq(dealtPlanCodes.codeHash, dealCodeHash(code)), eq(dealtPlanCodes.planId, plan.id), isNull(dealtPlanCodes.usedAt), sql`${dealtPlanCodes.expiresAt} > clock_timestamp()`)).returning({ planId: dealtPlanCodes.planId });
  if (used.length !== 1) throw new PlanError('This deal code is invalid or no longer available.', 409);
  await store.update(subscriptionPlans).set({ redeemedAt: new Date(), redeemedInstitutionId: institutionId }).where(eq(subscriptionPlans.id, plan.id));
}

export async function listManagedPlans() {
  await pruneExpiredDealtPlanCodes();
  const plans = await db.select().from(subscriptionPlans).where(isNull(subscriptionPlans.archivedAt)).orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.createdAt));
  const codes = await db.select({ planId: dealtPlanCodes.planId, expiresAt: dealtPlanCodes.expiresAt }).from(dealtPlanCodes).where(and(isNull(dealtPlanCodes.usedAt), sql`${dealtPlanCodes.expiresAt} > now()`));
  return plans.map(plan => ({ ...displayPlan(plan), redeemedAt: plan.redeemedAt?.toISOString() ?? null, codeExpiresAt: codes.find(code => code.planId === plan.id)?.expiresAt.toISOString() ?? null }));
}
