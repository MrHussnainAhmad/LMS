import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { JWTPayload } from './auth-types';
import { planPlatformAllowed } from './plan-entitlements';

export const MOBILE_APPS_DISABLED = {
  error: 'Mobile app access is disabled or is not included in your institution\'s plan. Contact your institution or platform admin.',
  code: 'MOBILE_APPS_DISABLED',
};
export const WEB_ACCESS_DISABLED = {
  error: 'Website access is not included in your institution\'s plan. Contact your institution or platform admin.',
  code: 'WEB_ACCESS_DISABLED',
};
export const isMobileRole = (role: string) => ['STUDENT', 'STAFF', 'PARENT'].includes(role);

/** Fresh primary-key lookup: disabling a product must not wait for a cache TTL.
 * A root institution's restriction also applies to its campuses. The mobile
 * toggle never restricts web access; subscription platform terms apply separately.
 * Tenant identity comes from auth, never
 * from a client-supplied school name or the email's suffix alone.
 */
export async function mobileAppAccessAllowed(
  session: Pick<JWTPayload, 'role' | 'institutionId' | 'clientType'>,
  nativeTransport = false,
  store: Pick<typeof db, 'execute'> = db,
): Promise<boolean> {
  if (!await planPlatformAllowed(session, nativeTransport || session.clientType === 'MOBILE', store)) return false;
  if (!isMobileRole(session.role) || (!nativeTransport && session.clientType !== 'MOBILE')) return true;
  if (!session.institutionId) return false;
  const result = await store.execute(sql`
    SELECT i.id FROM institutions i
    LEFT JOIN institutions root ON root.id=i.parent_institution_id
    WHERE i.id=${session.institutionId} AND i.apps_enabled AND i.status='APPROVED' AND i.deleted_at IS NULL
      AND (i.parent_institution_id IS NULL OR
        (root.apps_enabled AND root.status='APPROVED' AND root.deleted_at IS NULL))
    LIMIT 1
  `);
  return result.rows.length > 0;
}
