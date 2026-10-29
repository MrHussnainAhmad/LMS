import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptionPlans, institutionAgreementAcceptances, institutions } from '@/db/schema';
import { displayPlan, type PricingPlan } from './plan-types';

export async function getPublicPricingPlans(store: Pick<typeof db, 'select'> = db): Promise<PricingPlan[]> {
  const rows = await store.select().from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.kind, 'PUBLIC'), isNull(subscriptionPlans.archivedAt)))
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.createdAt));
  return rows.map(displayPlan);
}
export async function getPricingPlan(value: string | null | undefined, store: Pick<typeof db, 'select'> = db): Promise<PricingPlan | undefined> {
  if (!value) return undefined;
  const [plan] = await store.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, value.trim().toUpperCase())).limit(1);
  return plan ? displayPlan(plan) : undefined;
}
/** Assigned terms survive catalog removal and price changes. */
export async function getInstitutionPricingPlan(institutionId: number, store: Pick<typeof db, 'select'> = db): Promise<PricingPlan | undefined> {
  const [institution] = await store.select({ id: institutions.id, parentId: institutions.parentInstitutionId, planId: institutions.pricingPlan })
    .from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!institution) return undefined;
  const rootId = institution.parentId ?? institution.id;
  const [accepted] = await store.select({ snapshot: institutionAgreementAcceptances.snapshot }).from(institutionAgreementAcceptances)
    .where(eq(institutionAgreementAcceptances.institutionId, rootId)).limit(1);
  if (accepted?.snapshot.plan.definition) return displayPlan(accepted.snapshot.plan.definition);
  if (institution.parentId) {
    const [root] = await store.select({ planId: institutions.pricingPlan }).from(institutions).where(eq(institutions.id, rootId)).limit(1);
    return getPricingPlan(root?.planId, store);
  }
  return getPricingPlan(institution.planId, store);
}
