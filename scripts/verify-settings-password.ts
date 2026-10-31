import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { hash, verify } from '@node-rs/argon2';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { institutions, institutionAdmins, staff, students, parentAccounts, campuses, subjects, institutionCustomRoles, staffTeachableSubjects, parentStudents, auditLogs } from '../src/db/schema';
import { requiresPasswordChange } from '../src/lib/auth-types';

async function main() {
  for (const role of ['STUDENT', 'STAFF', 'PARENT', 'INSTITUTION', 'EMPLOYEE']) {
    assert.equal(requiresPasswordChange(role, true), true);
    assert.equal(requiresPasswordChange(role, false), false);
    assert.equal(requiresPasswordChange(role), false);
  }
  const memory = await PGlite.create();
  const fixtureDb = drizzle(memory);
  const effects: string[] = [];
  let allowedRoles: string[] = [];
  const fixtures: Record<string, Record<string, unknown>> = {
    '@/db': { db: fixtureDb },
    '@/lib/argon2-pool': { hashPassword: hash, verifyPassword: verify },
    '@/lib/rbac': {
      requireRole: (roles: string[], handler: unknown, options: { allowPasswordChangeRequired?: boolean }) => {
        allowedRoles = roles;
        assert.equal(options.allowPasswordChangeRequired, true);
        return handler;
      },
    },
    '@/lib/auth': {
      clearAuthCookies: async () => { effects.push('clearCookies'); },
      revokeAllSessions: async (role: string, id: number) => { effects.push(`revoke:${role}:${id}`); },
      createTokens: () => { throw Error('Web settings must not return tokens'); },
      setAuthCookies: () => { throw Error('Web settings must require login again'); },
    },
    '@/lib/user': {
      resolveUserCreatedAt: () => new Date(0),
    },
    '@/lib/notification-events': { notifySecurity: async () => {} },
    '@/lib/audit': { logAudit: async () => { effects.push('audit'); } },
  };
  const globalFixture = globalThis as typeof globalThis & { __settingsPasswordFixtures?: typeof fixtures };
  globalFixture.__settingsPasswordFixtures = fixtures;
  try {
    for (const table of [institutions, institutionAdmins, staff, students, parentAccounts, campuses, subjects, institutionCustomRoles, staffTeachableSubjects, parentStudents, auditLogs]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(column => `"${column.name}" ${column.columnType === 'PgEnumColumn' ? 'text' : column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`);
      await memory.exec(`CREATE TABLE "${config.name}" (${columns.join(',')})`);
    }
    const originalHash = await hash('CurrentPassword!123');
    await memory.query('INSERT INTO institutions (id, admin_password_hash, must_change_password) VALUES ($1, $2, true)', [7, originalHash]);
    await memory.query('INSERT INTO institution_admins (id, institution_id, password_hash) VALUES ($1, $2, $3)', [41, 7, originalHash]);
    await memory.query('INSERT INTO institution_admins (id, institution_id, password_hash) VALUES ($1, $2, $3)', [42, 8, originalHash]);
    for (const table of ['staff', 'students', 'parent_accounts']) {
      await memory.query(`INSERT INTO ${table} (id,institution_id,password_hash,must_change_password) VALUES (51,7,$1,true)`, [originalHash]);
    }

    const built = await build({
      entryPoints: ['src/app/api/auth/change-password/route.ts', 'src/lib/user.ts', 'src/lib/parent-identity.ts'], outdir: '.', bundle: true, write: false,
      platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'isolated-password-services', setup(builder) {
        builder.onResolve({ filter: /^@\// }, args => fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: `export const { ${Object.keys(fixtures[args.path]).join(', ')} } = globalThis.__settingsPasswordFixtures[${JSON.stringify(args.path)}];`, loader: 'js',
        }));
      } }],
    });
    const loaded = { exports: {} as { POST: (req: NextRequest, ctx: { session: { role: string; userId: number; institutionId?: number } }) => Promise<Response> } };
    new Function('require', 'module', 'exports', built.outputFiles.find(file => file.path.endsWith('/route.js') || file.path.endsWith('\\route.js'))!.text)(createRequire(path.resolve('package.json')), loaded, loaded.exports);
    assert(allowedRoles.includes('INSTITUTION'));
    assert(allowedRoles.includes('INSTITUTION_ADMIN'));
    assert(!allowedRoles.includes('SUPER_ADMIN'));

    async function submit(role: string, userId: number, institutionId: number | undefined, currentPassword: string, newPassword: string) {
      return loaded.exports.POST(new NextRequest('http://institution.localhost/api/auth/change-password', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }),
      }), { session: { role, userId, institutionId } });
    }
    for (const [role, userId] of [['INSTITUTION', 7], ['INSTITUTION_ADMIN', 41], ['STAFF', 51], ['STUDENT', 51], ['PARENT', 51]] as const) {
      effects.length = 0;
      assert.equal((await submit(role, userId, 7, 'WrongPassword!123', 'NewPassword!456')).status, 400);
      for (const password of ['short', 'CurrentPassword!123', '1234567890']) {
        assert.equal((await submit(role, userId, 7, 'CurrentPassword!123', password)).status, 400);
      }
      assert.deepEqual(effects, [], 'Rejected changes must not revoke sessions or clear cookies');
      const response = await submit(role, userId, 7, 'CurrentPassword!123', 'NewPassword!456');
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.role, role);
      assert.equal(body.accessToken, undefined);
      assert.deepEqual(effects, [`revoke:${role}:${userId}`, 'audit', 'clearCookies']);
      const accountTable = { INSTITUTION: institutions, INSTITUTION_ADMIN: institutionAdmins, STAFF: staff, STUDENT: students, PARENT: parentAccounts }[role];
      const passwordColumn = role === 'INSTITUTION' ? institutions.adminPasswordHash : (accountTable as typeof staff).passwordHash;
      const rows = await fixtureDb.select({ passwordHash: passwordColumn }).from(accountTable).where(eq(accountTable.id, userId));
      assert(await verify(rows[0].passwordHash, 'NewPassword!456'));
      if (role !== 'INSTITUTION_ADMIN') {
        const flag = await memory.query<{ must_change_password: boolean }>(`SELECT must_change_password FROM ${getTableConfig(accountTable).name} WHERE id=$1`, [userId]);
        assert.equal(flag.rows[0].must_change_password, false);
      }
      assert.equal(await verify(rows[0].passwordHash, 'CurrentPassword!123'), false);
      console.log(`PASS: ${role} verifies current password, rejects invalid replacements, saves a new hash and signs out sessions.`);
    }
    effects.length = 0;
    assert.equal((await submit('INSTITUTION_ADMIN', 42, 7, 'CurrentPassword!123', 'NewPassword!456')).status, 404);
    assert.equal((await submit('INSTITUTION_ADMIN', 42, undefined, 'CurrentPassword!123', 'NewPassword!456')).status, 404);
    assert.deepEqual(effects, []);
    const [otherAdmin] = await fixtureDb.select().from(institutionAdmins).where(eq(institutionAdmins.id, 42));
    assert.equal(otherAdmin.passwordHash, originalHash);
    const [institution] = await fixtureDb.select().from(institutions).where(eq(institutions.id, 7));
    assert.equal(institution.mustChangePassword, false);
    console.log('PASS: institution admins cannot change a password outside their institution; missing scope is rejected.');

    const accounts = { exports: {} as Pick<typeof import('../src/lib/user'), 'createStaffAccount'> };
    const parents = { exports: {} as typeof import('../src/lib/parent-identity') };
    for (const [filename, target] of [['user.js', accounts], ['parent-identity.js', parents]] as const) {
      new Function('require', 'module', 'exports', built.outputFiles.find(file => path.basename(file.path) === filename)!.text)(createRequire(path.resolve('package.json')), target, target.exports);
    }
    await memory.exec(`UPDATE institutions SET username='fixture' WHERE id=7;
      INSERT INTO campuses(id,institution_id,name) VALUES(31,7,'Own'),(32,8,'Other');
      INSERT INTO institution_custom_roles(id,institution_id,name) VALUES(10,7,'Teacher'),(11,8,'Other');
      INSERT INTO subjects(id,institution_id,name) VALUES(21,7,'Math'),(22,8,'Other');`);
    const staffInput = { name: 'Ada Example', phone: '03001234567', campusId: 31, customRoleId: 10, subjectIds: [21,21] };
    const firstStaff = await accounts.exports.createStaffAccount(7, staffInput);
    const secondStaff = await accounts.exports.createStaffAccount(7, staffInput);
    assert.equal(firstStaff.initialPassword, '1234567890');
    assert.notEqual(firstStaff.email, secondStaff.email, 'Existing generated logins receive a suffix');
    for (const account of [firstStaff, secondStaff]) {
      const [saved] = await fixtureDb.select().from(staff).where(eq(staff.id, account.id));
      assert(await verify(saved.passwordHash, '1234567890'));
      assert.equal(saved.mustChangePassword, true); assert.equal(saved.isActive, true);
      assert.equal(saved.campusId, 31); assert.equal(saved.customRoleId, 10);
      assert.equal((await fixtureDb.select().from(staffTeachableSubjects).where(eq(staffTeachableSubjects.staffId, account.id))).length, 1);
    }
    const beforeRejected = await fixtureDb.select().from(staff);
    await assert.rejects(accounts.exports.createStaffAccount(7, { ...staffInput, campusId: 32 }), /Campus not found/);
    await assert.rejects(accounts.exports.createStaffAccount(7, { ...staffInput, customRoleId: 11 }), /Custom role not found/);
    await assert.rejects(accounts.exports.createStaffAccount(7, { ...staffInput, subjectIds: [22] }), /subjects were not found/);
    await memory.exec('ALTER TABLE staff_teachable_subjects ADD CONSTRAINT fixture_subject_failure CHECK(subject_id <> 21) NOT VALID');
    await assert.rejects(accounts.exports.createStaffAccount(7, { ...staffInput, name: 'Rollback Teacher' }));
    assert.deepEqual(await fixtureDb.select().from(staff), beforeRejected, 'A subject insert failure rolls back the staff account');
    await memory.exec('ALTER TABLE staff_teachable_subjects DROP CONSTRAINT fixture_subject_failure');
    console.log('PASS: shared staff provisioning enforces initial credentials, login collisions, tenant ownership, subject deduplication and transaction rollback.');

    await memory.exec(`CREATE UNIQUE INDEX fixture_parent_email ON parent_accounts(institution_id,email);
      CREATE UNIQUE INDEX fixture_parent_student ON parent_students(institution_id,student_id);
      INSERT INTO students(id,institution_id,name) VALUES(52,7,'Second Child'),(53,8,'Other Child');`);
    const guardian = { institutionId: 7, studentId: 51, guardianEmail: ' Parent@Example.test ', actorId: 7, actorRole: 'INSTITUTION' as const };
    const activation = await parents.exports.prepareParentActivation(7, guardian.guardianEmail);
    assert.equal(activation?.temporaryPassword, '1234567890');
    const firstParent = await fixtureDb.transaction(tx => parents.exports.syncStudentGuardian(tx as unknown as Parameters<typeof parents.exports.syncStudentGuardian>[0], { ...guardian, activation }));
    const [savedParent] = await fixtureDb.select().from(parentAccounts).where(eq(parentAccounts.id, firstParent.parentId!));
    assert.equal(savedParent.email, 'parent@example.test'); assert.equal(savedParent.mustChangePassword, true);
    assert(await verify(savedParent.passwordHash!, '1234567890'));
    const changedParentHash = await hash('ParentChosenPassword!123');
    await fixtureDb.update(parentAccounts).set({ passwordHash: changedParentHash, mustChangePassword: false }).where(eq(parentAccounts.id, savedParent.id));
    assert.equal(await parents.exports.prepareParentActivation(7, guardian.guardianEmail), null);
    const secondParent = await fixtureDb.transaction(tx => parents.exports.syncStudentGuardian(tx as unknown as Parameters<typeof parents.exports.syncStudentGuardian>[0], { ...guardian, studentId: 52 }));
    assert.equal(secondParent.parentId, firstParent.parentId); assert.equal(secondParent.activation, null);
    const [reusedParent] = await fixtureDb.select().from(parentAccounts).where(eq(parentAccounts.id, savedParent.id));
    assert.equal(reusedParent.passwordHash, changedParentHash); assert.equal(reusedParent.mustChangePassword, false);
    const otherActivation = await parents.exports.prepareParentActivation(8, guardian.guardianEmail);
    const otherParent = await fixtureDb.transaction(tx => parents.exports.syncStudentGuardian(tx as unknown as Parameters<typeof parents.exports.syncStudentGuardian>[0], { ...guardian, institutionId: 8, studentId: 53, activation: otherActivation }));
    assert.notEqual(otherParent.parentId, firstParent.parentId, 'The same email in a different institution is a separate parent account');
    console.log('PASS: shared parent provisioning uses initial credentials once, preserves changed passwords when linking siblings and isolates institutions.');
  } finally {
    delete globalFixture.__settingsPasswordFixtures;
    await memory.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
