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
import { institutions, institutionAdmins, staff, students, parentAccounts } from '../src/db/schema';
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
      invalidateUserValidity: async (role: string, id: number) => { effects.push(`invalidate:${role}:${id}`); },
      resolveUserCreatedAt: () => new Date(0),
    },
    '@/lib/notification-events': { notifySecurity: async () => {} },
    '@/lib/audit': { logAudit: async () => { effects.push('audit'); } },
  };
  const globalFixture = globalThis as typeof globalThis & { __settingsPasswordFixtures?: typeof fixtures };
  globalFixture.__settingsPasswordFixtures = fixtures;
  try {
    for (const table of [institutions, institutionAdmins, staff, students, parentAccounts]) {
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
      entryPoints: ['src/app/api/auth/change-password/route.ts'], bundle: true, write: false,
      platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'isolated-password-services', setup(builder) {
        builder.onResolve({ filter: /^@\// }, args => fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: `export const { ${Object.keys(fixtures[args.path]).join(', ')} } = globalThis.__settingsPasswordFixtures[${JSON.stringify(args.path)}];`, loader: 'js',
        }));
      } }],
    });
    const loaded = { exports: {} as { POST: (req: NextRequest, ctx: { session: { role: string; userId: number; institutionId?: number } }) => Promise<Response> } };
    new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(path.resolve('package.json')), loaded, loaded.exports);
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
      assert.deepEqual(effects, [`invalidate:${role}:${userId}`, `revoke:${role}:${userId}`, 'audit', 'clearCookies']);
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
  } finally {
    delete globalFixture.__settingsPasswordFixtures;
    await memory.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
