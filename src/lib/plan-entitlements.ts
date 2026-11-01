import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { ActionInputError } from './action-input-error';
type Executor = Pick<typeof db, 'execute'>;
export type PlanEntitlements = { institutionId: number; studentLimit: number | null };
export async function getPlanEntitlements(institutionId: number, store: Executor = db): Promise<PlanEntitlements | undefined> {
  const result = await store.execute<PlanEntitlements>(sql`
    SELECT root.id AS "institutionId",
      CASE WHEN a.snapshot->'plan' ? 'definition' THEN (a.snapshot->'plan'->'definition'->>'studentLimit')::integer ELSE p.student_limit END AS "studentLimit"
    FROM institutions i JOIN institutions root ON root.id=COALESCE(i.parent_institution_id,i.id)
    LEFT JOIN institution_agreement_acceptances a ON a.institution_id=root.id
    LEFT JOIN subscription_plans p ON p.id=root.pricing_plan
    WHERE i.id=${institutionId} LIMIT 1`);
  return result.rows[0];
}
export async function assertStudentPlanCapacity(store: Executor, institutionId: number, additional: number) {
  const plan = await getPlanEntitlements(institutionId, store);
  if (!plan) throw new ActionInputError('No subscription plan is configured for this institution.');
  if (plan.studentLimit === null) return;
  await store.execute(sql`SELECT pg_advisory_xact_lock(36084,${plan.institutionId})`);
  const usage = await store.execute<{ count: number }>(sql`
    SELECT count(*)::integer AS count FROM students s JOIN institutions i ON i.id=s.institution_id
    WHERE COALESCE(i.parent_institution_id,i.id)=${plan.institutionId}
      AND s.deleted_at IS NULL AND s.academic_status<>'GRADUATED'`);
  if ((usage.rows[0]?.count ?? 0) + additional > plan.studentLimit) throw new ActionInputError(`Your plan allows up to ${plan.studentLimit} current students across all campuses. Contact your platform admin to increase the allowance.`);
}
