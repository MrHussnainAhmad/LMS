import { ActionInputError } from './action-input-error';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { institutions } from '@/db/schema';
import type { JWTPayload } from './auth-types';
import { assertPlatformOperator, assertSecurityPermission } from './security-permissions';
import { logAudit } from './audit';
import { invalidateReadCachePatterns } from './redis';

/** Permanent removal, including campus workspaces and identities without tenant FKs. */
export async function removeInstitution(session: JWTPayload, id: number, confirmation: string) {
  await assertSecurityPermission(session, 'platform.accounts');
  if (!Number.isSafeInteger(id) || id <= 0) throw new ActionInputError('Invalid institution.');
  await db.transaction(async tx => {
    const [account] = (await tx.execute<{ username: string; status: string; parent_institution_id: number | null }>(sql`SELECT username,status,parent_institution_id FROM institutions WHERE id=${id} FOR UPDATE`)).rows;
    if (!account || account.parent_institution_id !== null) throw new ActionInputError('Main institution not found.');
    if (account.status !== 'APPROVED') throw new ActionInputError('Only approved institutions can be removed.');
    if (confirmation !== `REMOVE ${account.username}`) throw new ActionInputError(`Type REMOVE ${account.username} to confirm.`);
    const family = (await tx.execute<{ id: number }>(sql`WITH RECURSIVE family AS (
      SELECT id FROM institutions WHERE id=${id} UNION ALL
      SELECT i.id FROM institutions i JOIN family f ON i.parent_institution_id=f.id
    ) SELECT id FROM family`)).rows;
    const ids = sql.join(family.map(row => sql`${row.id}`), sql`, `);
    const owners = sql`SELECT 'INSTITUTION' AS role,id FROM institutions WHERE id IN (${ids})
      UNION ALL SELECT 'INSTITUTION_ADMIN',id FROM institution_admins WHERE institution_id IN (${ids})
      UNION ALL SELECT 'STUDENT',id FROM students WHERE institution_id IN (${ids})
      UNION ALL SELECT 'STAFF',id FROM staff WHERE institution_id IN (${ids})
      UNION ALL SELECT 'PARENT',id FROM parent_accounts WHERE institution_id IN (${ids})`;
    for (const table of ['refresh_tokens', 'account_lockouts', 'pricing_notice_reads', 'expo_push_tickets', 'announcement_reads', 'password_resets']) {
      await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE (user_role::text,user_id) IN (${owners})`);
    }
    await tx.execute(sql`DELETE FROM account_deletions WHERE lower(admin_email) IN (SELECT lower(contact_email) FROM institutions WHERE id IN (${ids}))`);
    // These references deliberately restrict ordinary deletes, or retain rows
    // through SET NULL. Clear them before the remaining tenant cascades.
    for (const table of ['gateway_payment_attempts', 'admission_enrollments', 'admission_applications', 'courses', 'fee_billing_batches', 'staff_assignments', 'student_fee_adjustments', 'email_outbox']) {
      const intake = table === 'admission_applications' ? sql` OR intake_institution_id IN (${ids})` : sql``;
      await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE institution_id IN (${ids})${intake}`);
    }
    await tx.execute(sql`DELETE FROM institutions WHERE id IN (${ids})`);
  });
  await invalidateReadCachePatterns(['cache:*']);
}

/** Clears application records while retaining this Root account and migration history. */
export async function wipeDatabaseForTesting(session: JWTPayload, confirmation: string) {
  await assertSecurityPermission(session, 'platform.security');
  if (confirmation !== 'WIPE DATABASE') throw new ActionInputError('Type WIPE DATABASE to confirm.');
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`LOCK TABLE public.super_admins IN ACCESS EXCLUSIVE MODE`);
    const current = (await tx.execute(sql`SELECT id FROM super_admins WHERE id=${session.userId} AND is_super_admin=true`)).rows;
    if (!current.length) throw new ActionInputError('Forbidden');
    const tables = (await tx.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname='public'
      AND tablename NOT IN ('super_admins','__drizzle_migrations','nisaab360_supplemental_migrations') ORDER BY tablename`)).rows;
    if (!tables.length) throw new ActionInputError('Application tables were not found.');
    await tx.execute(sql`LOCK TABLE ${sql.join(tables.map(row => sql`public.${sql.identifier(row.tablename)}`), sql`, `)} IN SHARE ROW EXCLUSIVE MODE`);
    const references = (await tx.execute<{ child: string; parent: string }>(sql`
      SELECT child.relname AS child,parent.relname AS parent FROM pg_constraint fk
      JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
      WHERE fk.contype='f' AND cn.nspname='public' AND pn.nspname='public'
      AND fk.conrelid<>fk.confrelid AND fk.confdeltype<>'n'
    `)).rows;
    // Use the existing runtime DELETE permissions and preserve sequence values.
    // Children precede parents; refuse unknown cycles instead of bypassing FKs.
    const remaining = new Set(tables.map(row => row.tablename));
    const ordered: string[] = [];
    while (remaining.size) {
      const leaves = [...remaining].filter(table => !references.some(fk => fk.parent === table && remaining.has(fk.child)));
      if (!leaves.length) throw new ActionInputError('Database relationships prevent a testing reset.');
      for (const table of leaves) { ordered.push(table); remaining.delete(table); }
    }
    for (const table of ordered) await tx.execute(sql`DELETE FROM public.${sql.identifier(table)}`);
    await tx.execute(sql`DELETE FROM super_admins WHERE id<>${session.userId}`);
  });
  await invalidateReadCachePatterns(['cache:*']);
}

export async function changeInstitutionStatus(session: JWTPayload, id: number, status: 'PENDING' | 'APPROVED' | 'REJECTED', reason?: string) {
  await assertPlatformOperator(session);
  if (!Number.isSafeInteger(id) || id <= 0 || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new ActionInputError('Invalid institution status request.');
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM institutions WHERE id = ${id} FOR UPDATE`);
    const [account] = await tx.select({ status: institutions.status, parent: institutions.parentInstitutionId }).from(institutions).where(eq(institutions.id, id)).limit(1);
    if (!account || account.parent !== null) throw new ActionInputError('Main institution not found.');
    if (session.role === 'EMPLOYEE' && (account.status !== 'PENDING' || status === 'PENDING')) throw new ActionInputError('Forbidden: employees may review pending registrations only.');
    await tx.update(institutions).set({ status, rejectionReason: status === 'REJECTED' ? reason ?? null : null }).where(eq(institutions.id, id));
  });

  await logAudit({ actorId: session.userId, actorRole: session.role, action: `REVIEW_INSTITUTION_${status}`, target: `Institution ${id}`, ip: 'server-action' });
  const { redis } = await import('./redis');
  if (redis.status === 'ready') await redis.del('cache:sa:dashboard:overview', 'cache:sa:dashboard:recent-regs', 'cache:employee:dashboard:overview', 'cache:employee:dashboard:pending-list').catch(() => {});
}
