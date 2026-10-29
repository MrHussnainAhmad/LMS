import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { JWTPayload } from './auth-types';
import { getPlanEntitlements } from './plan-entitlements';
import { ActionInputError } from './action-input-error';

type Executor = Pick<typeof db, 'execute'>;
export class PlanDeviceLimitError extends ActionInputError { status = 403; }
export function deviceSessionExpiry(expiresAt: Date, clientType?: 'WEB' | 'MOBILE') {
  return new Date(Math.min(expiresAt.getTime(), Date.now() + (clientType === 'MOBILE' ? 30 : 5) * 86400_000));
}

export async function reservePlanDeviceSession(store: Executor, payload: JWTPayload, tokenHash: string, expiresAt: Date, replaceHash?: string) {
  if (!payload.institutionId || ['SUPER_ADMIN','EMPLOYEE'].includes(payload.role)) return undefined;
  const plan = await getPlanEntitlements(payload.institutionId, store);
  if (!plan || plan.deviceLimit === null) return undefined;
  await store.execute(sql`SELECT pg_advisory_xact_lock(36085,${plan.institutionId})`);
  if (replaceHash) await store.execute(sql`UPDATE plan_device_sessions SET revoked_at=now()
    WHERE refresh_token_hash=${replaceHash} AND user_role=${payload.role} AND user_id=${payload.userId}`);
  const usage = await store.execute<{ count: number }>(sql`SELECT count(*)::integer AS count FROM plan_device_sessions
    WHERE institution_id=${plan.institutionId} AND revoked_at IS NULL AND expires_at>now()`);
  if ((usage.rows[0]?.count ?? 0) >= plan.deviceLimit) throw new PlanDeviceLimitError(`Your institution's plan allows ${plan.deviceLimit} signed-in devices. Sign out of another device or contact your platform admin.`);
  const id = randomUUID();
  const deviceExpiry = deviceSessionExpiry(expiresAt, payload.clientType);
  await store.execute(sql`INSERT INTO plan_device_sessions(id,institution_id,user_role,user_id,refresh_token_hash,expires_at)
    VALUES(${id},${plan.institutionId},${payload.role},${payload.userId},${tokenHash},${deviceExpiry})`);
  return id;
}

export async function isPlanDeviceSessionActive(payload: JWTPayload) {
  if (!payload.planDeviceSessionId) return true;
  if (!payload.institutionId || !/^[a-f0-9-]{36}$/i.test(payload.planDeviceSessionId)) return false;
  const result = await db.execute(sql`SELECT d.id FROM plan_device_sessions d JOIN institutions i ON i.id=${payload.institutionId}
    WHERE d.id=${payload.planDeviceSessionId} AND d.institution_id=COALESCE(i.parent_institution_id,i.id)
      AND d.user_role=${payload.role} AND d.user_id=${payload.userId} AND d.revoked_at IS NULL AND d.expires_at>now() LIMIT 1`);
  return result.rows.length > 0;
}
