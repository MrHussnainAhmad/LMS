import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { JWTPayload } from './auth-types';

export const MOBILE_APPS_DISABLED = {
  error: 'Mobile apps are not enabled for your institution. You can still use the website.',
  code: 'MOBILE_APPS_DISABLED',
};
export const isMobileRole = (role: string) => ['STUDENT', 'STAFF', 'PARENT'].includes(role);

/** Fresh primary-key lookup: disabling a product must not wait for a cache TTL.
 * A root institution's restriction also applies to its campuses. Web access is
 * deliberately outside this entitlement. Tenant identity comes from auth, never
 * from a client-supplied school name or the email's suffix alone.
 */
export async function mobileAppAccessAllowed(
  session: Pick<JWTPayload, 'role' | 'institutionId' | 'clientType'>,
  nativeTransport = false,
  store: Pick<typeof db, 'execute'> = db,
): Promise<boolean> {
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
