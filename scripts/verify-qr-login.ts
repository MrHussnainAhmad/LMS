// Real SQL + real JWT/refresh-token issuer, disposable PostgreSQL WASM only.
// No .env, network, production database, native app, deployment or build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { hash as hashPassword } from '@node-rs/argon2';
import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '../src/lib/auth-types';

type FixtureMemory = {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
async function openFixture(): Promise<{ memory: FixtureMemory; db: unknown; label: string }> {
  const connectionString = process.env.QR_LOGIN_TEST_DATABASE_URL;
  if (!connectionString) {
    const memory = await PGlite.create();
    return { memory, db: drizzle(memory), label: 'isolated PostgreSQL WASM (serialized connection)' };
  }
  const url = new URL(connectionString);
  // Never accept the application's DATABASE_URL or a remote deployment target.
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]*qr_login_test$/.test(url.pathname)) throw new Error('Use a dedicated loopback database whose name ends in qr_login_test.');
  const schema = `qr_login_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString, max: 8, options: `-c search_path=${schema} -c timezone=UTC` });
  const memory = {
    exec: (sql: string) => pool.query(sql),
    query: <T>(sql: string, params?: unknown[]) => pool.query<T & pg.QueryResultRow>(sql, params),
    async close() {
      await pool.end();
      try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
      finally { await admin.end(); }
    },
  };
  return { memory, db: postgresDrizzle(pool), label: 'dedicated local PostgreSQL (8-connection pool)' };
}

async function main() {
  // Existing refresh-token timestamps use the application's UTC database convention.
  process.env.TZ = 'UTC';
  process.env.JWT_SECRET = 'isolated-qr-login-regression-secret-not-production';
  const fixture = await openFixture();
  const memory = fixture.memory;
  console.log('Fixture: ' + fixture.label);
  const state = {
    db: fixture.db, server: { NextResponse }, after: [] as (() => Promise<void>)[],
    counts: new Map<string, number>(), redisStatus: 'ready', expireError: false,
    audit: [] as unknown[], cookies: new Map<string, string>(),
  };
  (globalThis as typeof globalThis & { __qrLogin?: typeof state }).__qrLogin = state;
  const mocks: Record<string, string> = {
    db: 'export const db=globalThis.__qrLogin.db;',
    'next/server': 'export const NextResponse=globalThis.__qrLogin.server.NextResponse;export const after=fn=>globalThis.__qrLogin.after.push(fn);',
    'next/headers': `export const cookies=async()=>({get:name=>{const value=globalThis.__qrLogin.cookies.get(name);return value?{value}:undefined},set:(key,value)=>globalThis.__qrLogin.cookies.set(key,value),delete:key=>globalThis.__qrLogin.cookies.delete(key)});export const headers=async()=>new Headers({host:'localhost:3000'});`,
    redis: `export const redis={get status(){return globalThis.__qrLogin.redisStatus},get:async()=>null,setex:async()=>{},multi(){let key;return {incr(k){key=k;return this},expire(){return this},async exec(){const s=globalThis.__qrLogin;const n=(s.counts.get(key)||0)+1;s.counts.set(key,n);return [[null,n],[s.expireError?new Error('fixture'):null,1]]}}}};`,
    user: 'export const getFreshStudent=async()=>null;export const verifyUserExistsFresh=async()=>true;export const getUserCreatedAt=async()=>new Date();',
    'auth-student': 'export const enrichFreshStudentSession=x=>x;',
    'campus-workspaces': 'export const resolveCampusSession=async x=>x;',
    'notification-events': 'export const notifySecurity=async()=>{};',
    audit: 'export const logAudit=async data=>globalThis.__qrLogin.audit.push(data);',
    'argon2-pool': `import {verify} from '@node-rs/argon2';export const verifyPassword=verify;`,
  };
  async function load<T>(entry: string): Promise<T> {
    const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'qr-login-isolation', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.kind === 'entry-point') return;
          if (mocks[args.path]) return { path: args.path, namespace: 'fixture' };
          const absolute = args.path.startsWith('@/') ? path.resolve('src', args.path.slice(2)) : args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : '';
          const key = absolute === path.resolve('src/db') ? 'db' : path.dirname(absolute) === path.resolve('src/lib') ? path.basename(absolute).replace(/\.ts$/, '') : '';
          if (mocks[key]) return { path: key, namespace: 'fixture' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
      } }],
    });
    const loaded = { exports: {} as T };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(path.resolve('package.json')), loaded, loaded.exports);
    return loaded.exports;
  }
  let checks = 0;
  const pass = (label: string) => { checks++; console.log('PASS ' + label); };
  try {
    await memory.exec(`
      CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','EMPLOYEE','INSTITUTION','INSTITUTION_ADMIN','STAFF','STUDENT','PARENT');
      CREATE TABLE institutions (id integer PRIMARY KEY, status text NOT NULL DEFAULT 'APPROVED', deleted_at timestamp,
        parent_institution_id integer, allow_graduated_student_access boolean NOT NULL DEFAULT false);
      CREATE TABLE students (id integer PRIMARY KEY, institution_id integer NOT NULL, password_hash text NOT NULL,
        must_change_password boolean DEFAULT false, is_active boolean DEFAULT true, deleted_at timestamp,
        academic_status text DEFAULT 'ACTIVE', login_roll_number text DEFAULT 'fixture-student', created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE staff (id integer PRIMARY KEY, institution_id integer NOT NULL, password_hash text NOT NULL,
        must_change_password boolean DEFAULT false, is_active boolean DEFAULT true, deleted_at timestamp,
        campus_id integer, email text DEFAULT 'fixture-staff', created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE refresh_tokens (id serial PRIMARY KEY, user_role user_role NOT NULL, user_id integer NOT NULL,
        token_hash text NOT NULL UNIQUE, expires_at timestamp NOT NULL, revoked_at timestamp, replaced_by_hash text,
        reuse_detected_at timestamp, created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE account_lockouts (id serial PRIMARY KEY, user_role user_role NOT NULL, user_id integer NOT NULL,
        locked_until timestamp, failed_count integer NOT NULL DEFAULT 0, window_started_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_role,user_id));
      INSERT INTO institutions(id) VALUES (1),(2);
      INSERT INTO students(id,institution_id,password_hash) VALUES (1,1,'student-password-hash'),(2,2,'other-student-hash');
      UPDATE students SET login_roll_number='fixture-other-student' WHERE id=2;
      INSERT INTO staff(id,institution_id,password_hash,campus_id) VALUES (10,1,'staff-password-hash',7);
    `);
    await memory.exec('CREATE TABLE push_devices(id serial PRIMARY KEY, session_token_hash varchar(64), revoked_at timestamptz, updated_at timestamptz)');
    const migration = readFileSync('drizzle/0078_qr_account_login.sql', 'utf8');
    await memory.exec(migration);
    await memory.exec(migration);
    const sessionMigration = readFileSync('drizzle/0079_qr_login_sessions.sql', 'utf8');
    await memory.exec(sessionMigration);
    await memory.exec(sessionMigration);
    await memory.exec(readFileSync('drizzle/0081_institution_mobile_apps.sql', 'utf8'));
    await memory.exec("ALTER TABLE institutions ADD COLUMN pricing_plan varchar(20) NOT NULL DEFAULT 'BASIC'");
    await memory.exec(readFileSync('drizzle/0082_institution_agreement_acceptance.sql', 'utf8'));
    await memory.exec(readFileSync('drizzle/0083_admin_managed_plans.sql', 'utf8'));
    const indexes = await memory.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename='qr_login_challenges'");
    for (const name of ['qr_login_challenges_pkey', 'qr_login_challenges_source_idx', 'qr_login_challenges_expiry_idx']) assert.ok(indexes.rows.some(row => row.indexname === name));
    const columns = await memory.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='qr_login_challenges'");
    assert.equal(columns.rows.length, 11);
    assert.match(readFileSync('scripts/migrate-production.mjs', 'utf8'), /0078_qr_account_login\.sql/);
    pass('forward migration creates required fields/indexes and is idempotent against existing authentication tables');

    const service = await load<typeof import('../src/lib/qr-login')>('src/lib/qr-login.ts');
    const auth = await load<typeof import('../src/lib/auth')>('src/lib/auth.ts');
    type Route = { POST(req: NextRequest): Promise<Response> };
    const create = await load<Route>('src/app/api/auth/qr-login/route.ts');
    const redeem = await load<Route>('src/app/api/auth/qr-login/redeem/route.ts');
    const resource = await load<{ GET(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response>; DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> }>('src/app/api/auth/qr-login/[id]/route.ts');
    const refresh = await load<Route>('src/app/api/auth/refresh/route.ts');
    const logout = await load<Route>('src/app/api/auth/logout/route.ts');
    async function owner(role: UserRole = 'STUDENT', userId = 1, institutionId = 1) {
      const tokens = await auth.createTokens({ userId, institutionId, role });
      return { tokens, owner: await service.readQrOwner(tokens.accessToken, tokens.refreshToken) };
    }
    const student = await owner();
    const teacher = await owner('STAFF', 10);
    const other = await owner('STUDENT', 2, 2);
    const context = (id: string) => ({ params: Promise.resolve({ id }) });
    function native(qr: unknown, extra: Record<string, string> = {}, extraBody: object = {}) {
      return new NextRequest('https://nisaab360.app/api/auth/qr-login/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-QR-Login': '1', ...extra }, body: JSON.stringify({ qr, ...extraBody }) });
    }
    function web(id = '', method = 'GET', identity = student, extra: Record<string, string> = {}) {
      return new NextRequest(`https://student.nisaab360.app/api/auth/qr-login${id ? `/${id}` : ''}`, { method, headers: {
        host: 'student.nisaab360.app', origin: 'https://student.nisaab360.app', 'sec-fetch-site': 'same-origin', 'X-QR-Login': '1',
        cookie: `access_token=${identity.tokens.accessToken}; refresh_token=${identity.tokens.refreshToken}`, ...extra,
      } });
    }
    async function countTokens() { return (await memory.query<{ count: number }>('SELECT count(*)::int AS count FROM refresh_tokens')).rows[0].count; }
    for (const identity of [student, teacher]) {
      state.counts.clear();
      const response = await create.POST(web('', 'POST', identity));
      assert.equal(response.status, 201);
      assert.match(response.headers.get('cache-control')!, /no-store/);
      const challenge = await response.json();
      assert.match(challenge.qrImageDataUrl, /^data:image\/png;base64,/);
      assert.equal(challenge.status, 'PENDING');
      const expires = Date.parse(challenge.expiresAt) - Date.now();
      assert.ok(expires > 50_000 && expires <= 60_000);
      assert.ok(service.parseQrLogin(challenge.qr));
      assert.ok(!challenge.qr.includes(identity.tokens.accessToken));
      const stored = (await memory.query<{ secret_hash: string }>('SELECT secret_hash FROM qr_login_challenges WHERE id=$1', [challenge.challengeId])).rows[0];
      assert.match(stored.secret_hash, /^[0-9a-f]{64}$/);
      assert.notEqual(stored.secret_hash, challenge.qr.split(':').at(-1));
      const response2 = await redeem.POST(native(challenge.qr));
      assert.equal(response2.status, 200);
      assert.equal(response2.headers.get('set-cookie'), null);
      const result = await response2.json();
      assert.deepEqual(Object.keys(result).sort(), ['accessToken', 'message', 'mustChangePassword', 'refreshToken', 'role']);
      assert.equal(result.role, identity.owner.payload.role);
      assert.equal(result.mustChangePassword, false);
      const decoded = await auth.verifyAccessToken(result.accessToken);
      assert.equal(decoded?.institutionId, identity.owner.payload.institutionId);
      assert.equal(decoded?.userId, identity.owner.payload.userId);
      assert.ok(decoded?.createdAt);
      if (result.role === 'STAFF') assert.equal(decoded?.campusId, 7);
      const status = await resource.GET(web(challenge.challengeId, 'GET', identity), context(challenge.challengeId));
      assert.equal((await status.json()).status, 'CONSUMED');
      assert.equal((await redeem.POST(native(challenge.qr))).status, 401);
    }
    pass('Student and Staff HTTP redemption use existing issuer/response, correct tenant/campus/identity, secret hashes and single-use status');

    for (const role of ['PARENT', 'INSTITUTION', 'INSTITUTION_ADMIN', 'EMPLOYEE', 'SUPER_ADMIN'] as UserRole[]) {
      const tokens = await auth.createTokens({ role, userId: 999, institutionId: 1 });
      await assert.rejects(service.readQrOwner(tokens.accessToken, tokens.refreshToken), /only available/);
    }
    await assert.rejects(service.readQrOwner('invalid', 'a'.repeat(80)), /Sign in/);
    await assert.rejects(service.readQrOwner(student.tokens.accessToken, teacher.tokens.refreshToken).then(service.createQrLogin), /session expired/);
    pass('unauthorized roles, invalid access credentials and mismatched access/refresh identities cannot create challenges');

    const roleBound = await service.createQrLogin(teacher.owner);
    const beforeMismatch = await countTokens();
    assert.equal((await redeem.POST(native(roleBound.qr, {}, { roleHint: 'STUDENT' }))).status, 403);
    assert.equal(await countTokens(), beforeMismatch);
    assert.equal((await service.inspectQrLogin(teacher.owner, roleBound.challengeId)).status, 'PENDING');
    assert.equal((await redeem.POST(native(roleBound.qr, {}, { roleHint: 'PARENT' }))).status, 400);
    assert.equal((await redeem.POST(native(roleBound.qr, {}, { roleHint: 'STAFF' }))).status, 200);
    pass('role hints restrict the selected mobile login type without consuming a mismatched QR or minting credentials');

    state.counts.clear();
    const first = await service.createQrLogin(student.owner);
    const second = await service.createQrLogin(student.owner);
    assert.equal((await service.inspectQrLogin(student.owner, first.challengeId)).status, 'REVOKED');
    await assert.rejects(service.redeemQrLogin(first.qr), /no longer available/);
    assert.equal((await service.inspectQrLogin(student.owner, second.challengeId, true)).status, 'REVOKED');
    await assert.rejects(service.redeemQrLogin(second.qr), /no longer available/);
    assert.equal((await service.inspectQrLogin(student.owner, second.challengeId, true)).status, 'REVOKED');
    pass('refresh invalidates older codes; owner revocation is repeatable and prevents redemption');

    const expiring = await service.createQrLogin(student.owner);
    await memory.query("UPDATE qr_login_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [expiring.challengeId]);
    assert.equal((await service.inspectQrLogin(student.owner, expiring.challengeId)).status, 'EXPIRED');
    await assert.rejects(service.redeemQrLogin(expiring.qr), /no longer available/);
    const shortened = await service.createQrLogin({ ...student.owner, accessExpiresAt: Date.now() + 20_000 });
    assert.ok(Date.parse(shortened.expiresAt) - Date.now() <= 20_000);
    pass('server expiration is enforced and cannot outlive the originating access session');

    await memory.exec("SET TIME ZONE 'Asia/Karachi'");
    const zoned = await service.createQrLogin(student.owner);
    await service.redeemQrLogin(zoned.qr);
    await memory.exec("SET TIME ZONE 'UTC'");
    pass('timezone-aware QR timestamps remain valid when the PostgreSQL session timezone changes');

    const tenantQr = await service.createQrLogin(student.owner);
    await assert.rejects(service.inspectQrLogin(other.owner, tenantQr.challengeId), /not found/);
    await assert.rejects(service.createQrLogin({ ...student.owner, payload: { ...student.owner.payload, institutionId: 2 } }), /no longer available/);
    const secondSession = await owner();
    await assert.rejects(service.inspectQrLogin(secondSession.owner, tenantQr.challengeId, true), /not found/);
    assert.equal((await redeem.POST(native(tenantQr.qr, {}, { institutionId: 2 }))).status, 400);
    pass('tenant/account/session isolation and strict payload validation prevent client-supplied scope changes');

    for (const [label, modify, restore] of [
      ['inactive student', 'UPDATE students SET is_active=false WHERE id=1', 'UPDATE students SET is_active=true WHERE id=1'],
      ['deleted student', 'UPDATE students SET deleted_at=now() WHERE id=1', 'UPDATE students SET deleted_at=NULL WHERE id=1'],
      ['suspended tenant', "UPDATE institutions SET status='SUSPENDED' WHERE id=1", "UPDATE institutions SET status='APPROVED' WHERE id=1"],
      ['deleted tenant', 'UPDATE institutions SET deleted_at=now() WHERE id=1', 'UPDATE institutions SET deleted_at=NULL WHERE id=1'],
      ['restricted graduate', "UPDATE students SET academic_status='GRADUATED' WHERE id=1", "UPDATE students SET academic_status='ACTIVE' WHERE id=1"],
      ['active lockout', "INSERT INTO account_lockouts(user_role,user_id,locked_until) VALUES ('STUDENT',1,now()+interval '5 minutes')", 'DELETE FROM account_lockouts'],
      ['inactive root', "UPDATE institutions SET parent_institution_id=2 WHERE id=1; UPDATE institutions SET status='SUSPENDED' WHERE id=2", "UPDATE institutions SET parent_institution_id=NULL WHERE id=1; UPDATE institutions SET status='APPROVED' WHERE id=2"],
    ]) {
      const challenge = await service.createQrLogin(student.owner);
      await memory.exec(modify);
      await assert.rejects(service.createQrLogin(student.owner), /no longer available/, label + ' create');
      await assert.rejects(service.redeemQrLogin(challenge.qr), /no longer available/, label + ' redeem');
      await memory.exec(restore);
    }
    const staffQr = await service.createQrLogin(teacher.owner);
    await memory.exec('UPDATE staff SET is_active=false WHERE id=10');
    await assert.rejects(service.redeemQrLogin(staffQr.qr), /no longer available/);
    await memory.exec('UPDATE staff SET is_active=true, deleted_at=now() WHERE id=10');
    await assert.rejects(service.createQrLogin(teacher.owner), /no longer available/);
    await memory.exec('UPDATE staff SET deleted_at=NULL WHERE id=10');
    pass('creation and redemption freshly enforce account, graduate, tenant/root, deletion and lockout eligibility');

    const changed = await service.createQrLogin(teacher.owner);
    await memory.exec("UPDATE staff SET password_hash='changed-hash' WHERE id=10");
    await assert.rejects(service.redeemQrLogin(changed.qr), /no longer available/);
    await memory.exec("UPDATE staff SET password_hash='staff-password-hash' WHERE id=10");
    const moved = await service.createQrLogin(teacher.owner);
    await memory.exec('UPDATE staff SET institution_id=2 WHERE id=10');
    await assert.rejects(service.redeemQrLogin(moved.qr), /no longer available/);
    await memory.exec('UPDATE staff SET institution_id=1 WHERE id=10');
    pass('password changes and tenant transfers after issuance invalidate captured codes');

    const concurrent = await service.createQrLogin(student.owner);
    const before = await countTokens();
    const attempts = await Promise.allSettled([service.redeemQrLogin(concurrent.qr), service.redeemQrLogin(concurrent.qr)]);
    assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(await countTokens(), before + 1);
    pass('simultaneous redemption attempts yield one session and one rejection in the isolated SQL fixture');

    const cancelRace = await service.createQrLogin(student.owner);
    const beforeCancelRace = await countTokens();
    const [scanResult, cancelResult] = await Promise.allSettled([
      service.redeemQrLogin(cancelRace.qr), service.inspectQrLogin(student.owner, cancelRace.challengeId, true),
    ]);
    assert.equal(cancelResult.status, 'fulfilled');
    if (cancelResult.status === 'fulfilled') assert.equal(cancelResult.value.status, scanResult.status === 'fulfilled' ? 'CONSUMED' : 'REVOKED');
    assert.equal(await countTokens(), beforeCancelRace + (scanResult.status === 'fulfilled' ? 1 : 0));
    pass('a scan racing owner cancellation reaches exactly one consistent terminal state');

    const rollback = await service.createQrLogin(student.owner);
    await memory.exec(`CREATE FUNCTION reject_test_token() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture issuer failure'; END $$;
      CREATE TRIGGER reject_test_token BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_test_token();`);
    const beforeFailure = await countTokens();
    const failed = await redeem.POST(native(rollback.qr));
    assert.equal(failed.status, 503);
    assert.equal(await countTokens(), beforeFailure);
    assert.equal((await service.inspectQrLogin(student.owner, rollback.challengeId)).status, 'PENDING');
    await memory.exec('DROP TRIGGER reject_test_token ON refresh_tokens; DROP FUNCTION reject_test_token();');
    assert.equal((await redeem.POST(native(rollback.qr))).status, 200);
    pass('database/token insertion failures roll back consumption and allow a safe retry without orphan sessions');

    const lifecycleOwner = await owner();
    const pending = await service.createQrLogin(lifecycleOwner.owner);
    const mobile = await service.redeemQrLogin(pending.qr);
    const refreshed = await refresh.POST(new NextRequest('https://nisaab360.app/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: mobile.refreshToken }) }));
    assert.equal(refreshed.status, 200);
    const rotated = await refreshed.json();
    assert.notEqual(rotated.refreshToken, mobile.refreshToken);
    assert.equal((await auth.verifyAccessToken(rotated.accessToken))?.role, 'STUDENT');
    await logout.POST(new NextRequest('https://nisaab360.app/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rotated.refreshToken }) }));
    assert.equal((await auth.rotateRefreshToken(rotated.refreshToken)).status, 'INVALID');
    const unused = await service.createQrLogin(lifecycleOwner.owner);
    await auth.revokeRefreshToken(lifecycleOwner.tokens.refreshToken);
    await assert.rejects(service.redeemQrLogin(unused.qr), /no longer available/);
    pass('QR mobile sessions use existing refresh rotation and logout; web logout invalidates pending codes');

    const expiresOwner = await owner();
    const expiredSource = await service.createQrLogin(expiresOwner.owner);
    await memory.query("UPDATE refresh_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [expiresOwner.owner.sourceHash]);
    await assert.rejects(service.redeemQrLogin(expiredSource.qr), /no longer available/);
    const rotatingOwner = await owner();
    const beforeRotation = await service.createQrLogin(rotatingOwner.owner);
    assert.equal((await auth.rotateRefreshToken(rotatingOwner.tokens.refreshToken)).status, 'ROTATED');
    await assert.rejects(service.redeemQrLogin(beforeRotation.qr), /no longer available/);
    const resetOwner = await owner();
    const beforeReset = await service.createQrLogin(resetOwner.owner);
    await auth.revokeAllSessions('STUDENT', 1);
    await assert.rejects(service.redeemQrLogin(beforeReset.qr), /no longer available/);
    pass('source-session expiry, rotation and revoke-all invalidate unused codes');

    // Re-establish web sessions after exercising revoke-all.
    Object.assign(student, await owner());

    for (const bad of [null, '', 'https://nisaab360.app/verify/student?token=id-card', 'x'.repeat(1000), concurrent.qr + '?x=1', concurrent.qr.replace('v1:', 'v2:')]) assert.equal(service.parseQrLogin(bad), null);
    const guessed = await service.createQrLogin(student.owner);
    await assert.rejects(service.redeemQrLogin(guessed.qr.slice(0, -43) + 'A'.repeat(43)), /no longer available/);
    const invalidHeaders: Record<string, string>[] = [{ origin: 'https://evil.example' }, { authorization: 'Bearer x' }, { 'X-QR-Login': '' }, { 'sec-fetch-site': 'same-origin' }];
    for (const headers of invalidHeaders) assert.equal((await redeem.POST(native(guessed.qr, headers))).status, 403);
    assert.equal((await create.POST(web('', 'POST', student, { origin: 'https://evil.example' }))).status, 403);
    assert.equal((await create.POST(web('', 'POST', student, { origin: 'https://staff.nisaab360.app' }))).status, 403);
    assert.equal((await create.POST(web('', 'POST', student, { 'X-QR-Login': '' }))).status, 403);
    assert.equal((await redeem.POST(native(guessed.qr, { 'Content-Type': 'text/plain' }))).status, 415);
    assert.equal((await redeem.POST(new NextRequest('https://nisaab360.app/api/auth/qr-login/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-QR-Login': '1' }, body: '{' }))).status, 400);
    assert.equal((await redeem.POST(native('x'.repeat(17000)))).status, 413);
    pass('malformed QR/JSON, wrong secrets, ID-card confusion, oversized input and browser/CSRF requests are rejected');

    const nativeJar = await service.createQrLogin(student.owner);
    const jarResponse = await redeem.POST(native(nativeJar.qr, { cookie: `access_token=${other.tokens.accessToken}; refresh_token=${other.tokens.refreshToken}` }));
    assert.equal(jarResponse.status, 200);
    const jarTokens = await jarResponse.json();
    assert.equal((await auth.verifyAccessToken(jarTokens.accessToken))?.institutionId, 1);
    assert.equal(jarResponse.headers.get('set-cookie'), null);
    pass('native cookie jars cannot change QR identity and redemption never changes web cookies');

    state.counts.clear();
    const limiter = await load<typeof import('../src/lib/rate-limit')>('src/lib/rate-limit.ts');
    for (let index = 0; index < 30; index++) assert.equal((await limiter.withQrLoginRateLimit(native('x'), 'redeem')).success, true);
    assert.equal((await redeem.POST(native(guessed.qr))).status, 429);
    state.counts.clear();
    for (let index = 0; index < 10; index++) assert.equal((await limiter.withQrLoginRateLimit(web('', 'POST'), 'create', 'STUDENT:1')).success, true);
    assert.equal((await create.POST(web('', 'POST'))).status, 429);
    state.redisStatus = 'end';
    assert.equal((await redeem.POST(native(guessed.qr))).status, 503);
    state.redisStatus = 'ready'; state.expireError = true;
    assert.equal((await redeem.POST(native(guessed.qr))).status, 503);
    state.expireError = false; state.counts.clear();
    pass('shared IP/account limits enforce 429; Redis outages and TTL failures fail closed with 503');

    const passwordLogin = await load<Route>('src/app/api/auth/login/route.ts');
    for (const [role, table, id, identifier] of [
      ['STUDENT', 'students', 1, 'fixture-student'], ['STAFF', 'staff', 10, 'fixture-staff'],
    ] as const) {
      const password = 'Isolated-password-test!42';
      await memory.query(`UPDATE ${table} SET password_hash=$1 WHERE id=$2`, [await hashPassword(password), id]);
      state.counts.clear();
      const response = await passwordLogin.POST(new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: identifier, password, roleHint: role, returnTokens: true }),
      }));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.role, role);
      assert.equal(result.mustChangePassword, false);
      assert.equal((await auth.verifyAccessToken(result.accessToken))?.userId, id);
      assert.match(result.refreshToken, /^[a-f0-9]{80}$/);
    }
    pass('unchanged Student and Staff password routes still verify Argon2 passwords and issue the same mobile response');

    Object.assign(student, await owner());
    const old = await service.createQrLogin(student.owner);
    await memory.query("UPDATE qr_login_challenges SET expires_at=now()-interval '2 days' WHERE id=$1", [old.challengeId]);
    const kept = await service.createQrLogin(student.owner);
    await service.pruneExpiredQrLoginChallenges();
    assert.equal((await memory.query('SELECT id FROM qr_login_challenges WHERE id=$1', [old.challengeId])).rows.length, 0);
    assert.equal((await service.inspectQrLogin(student.owner, kept.challengeId)).status, 'PENDING');
    assert.ok(state.after.length > 0);
    await Promise.all(state.after.map(work => work()));
    assert.ok(state.audit.every(event => !JSON.stringify(event).includes('nisaab360:qr-login')));
    pass('bounded cleanup preserves live codes and successful-login audits contain no QR secrets');
    state.counts.clear();
    const historyRoute = await load<{ GET(req: NextRequest): Promise<Response> }>('src/app/api/auth/qr-login/sessions/route.ts');
    const revokeSessionRoute = await load<{ DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> }>('src/app/api/auth/qr-login/sessions/[id]/route.ts');
    const heartbeat = await load<{ GET(req: NextRequest): Promise<Response> }>('src/app/api/auth/qr-login/session/route.ts');
    const dashboardOwner = await owner();
    const secondBrowser = await owner();
    const privateOwner = await owner('STUDENT', 2, 2);
    const sessionChallenge = await service.createQrLogin(dashboardOwner.owner);
    const sessionResponse = await redeem.POST(native(sessionChallenge.qr, {}, { deviceName: 'Samsung Test Phone' }));
    assert.equal(sessionResponse.status, 200);
    const sessionTokens = await sessionResponse.json();
    const sessionClaims = await auth.verifyAccessToken(sessionTokens.accessToken);
    assert.ok(sessionClaims?.qrSessionId);
    assert.ok(sessionClaims!.qrSessionExpiresAt! * 1000 - Date.now() > 29.99 * 86400000);
    assert.ok(sessionClaims!.qrSessionExpiresAt! * 1000 - Date.now() <= 30 * 86400000);
    await service.listQrLoginSessions(secondBrowser.owner);
    const history = await historyRoute.GET(web('sessions', 'GET', secondBrowser));
    assert.equal(history.status, 200);
    const listed = (await history.json()).sessions;
    assert.ok(listed.length <= 20);
    const entry = listed.find((row: { id: string }) => row.id === sessionClaims!.qrSessionId);
    assert.equal(entry.deviceName, 'Samsung Test Phone');
    assert.equal(entry.status, 'ACTIVE');
    assert.ok(!JSON.stringify(listed).includes(sessionTokens.refreshToken));
    assert.equal((await revokeSessionRoute.DELETE(web('sessions/' + entry.id, 'DELETE', privateOwner), context(entry.id))).status, 404);
    assert.equal((await revokeSessionRoute.DELETE(web('sessions/' + entry.id, 'DELETE', secondBrowser, { origin: 'https://evil.example' }), context(entry.id))).status, 403);
    pass('QR history lists bounded account-owned device/time/expiry metadata across web sessions and rejects cross-tenant revocation and CSRF');

    const mobileHeartbeat = (access: string) => new NextRequest('http://localhost:3000/api/auth/qr-login/session', { headers: { authorization: 'Bearer ' + access } });
    assert.equal((await heartbeat.GET(mobileHeartbeat(sessionTokens.accessToken))).status, 200);
    const refreshRequest = (token: string) => new NextRequest('http://localhost:3000/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
    const refreshResult = await refresh.POST(refreshRequest(sessionTokens.refreshToken));
    assert.equal(refreshResult.status, 200);
    const replacement = await refreshResult.json();
    const replacementClaims = await auth.verifyAccessToken(replacement.accessToken);
    assert.equal(replacementClaims?.qrSessionId, entry.id);
    assert.equal(replacementClaims?.qrSessionExpiresAt, sessionClaims!.qrSessionExpiresAt);
    const expiries = await memory.query<{ expires_at: Date }>('SELECT expires_at FROM refresh_tokens WHERE qr_session_id=$1', [entry.id]);
    assert.ok(expiries.rows.every(row => new Date(row.expires_at).getTime() === sessionClaims!.qrSessionExpiresAt! * 1000));
    assert.equal((await revokeSessionRoute.DELETE(web('sessions/' + entry.id, 'DELETE', secondBrowser), context(entry.id))).status, 200);
    assert.equal(await auth.verifyAccessToken(sessionTokens.accessToken), null, 'Even previously cached JWTs stop authenticating');
    assert.equal(await auth.verifyAccessToken(replacement.accessToken), null);
    assert.equal((await heartbeat.GET(mobileHeartbeat(replacement.accessToken))).status, 401);
    assert.equal((await auth.rotateRefreshToken(replacement.refreshToken)).status, 'EXPIRED');
    assert.equal((await service.listQrLoginSessions(secondBrowser.owner)).find(row => row.id === entry.id)?.status, 'REVOKED');
    assert.equal((await revokeSessionRoute.DELETE(web('sessions/' + entry.id, 'DELETE', secondBrowser), context(entry.id))).status, 200);
    pass('QR refresh rotation preserves the absolute 30-day expiry and owner revocation invalidates old/new cached access tokens, heartbeat and refresh');

    const expiringSession = await service.redeemQrLogin((await service.createQrLogin(secondBrowser.owner)).qr, 'STUDENT', 'Expiry phone');
    await memory.query("UPDATE qr_login_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [expiringSession.payload.qrSessionId]);
    assert.equal(await auth.verifyAccessToken(expiringSession.accessToken), null);
    assert.equal((await auth.rotateRefreshToken(expiringSession.refreshToken)).status, 'EXPIRED');
    assert.equal((await service.listQrLoginSessions(secondBrowser.owner)).find(row => row.id === expiringSession.payload.qrSessionId)?.status, 'EXPIRED');
    const signingOut = await service.redeemQrLogin((await service.createQrLogin(secondBrowser.owner)).qr);
    await auth.revokeRefreshToken(signingOut.refreshToken);
    assert.equal(await auth.verifyAccessToken(signingOut.accessToken), null);
    assert.equal((await service.listQrLoginSessions(secondBrowser.owner)).find(row => row.id === signingOut.payload.qrSessionId)?.status, 'REVOKED');
    pass('expiry denies access/refresh without a cleanup cron, and ordinary mobile logout updates history and invalidates QR access');
    const raced = await service.redeemQrLogin((await service.createQrLogin(secondBrowser.owner)).qr);
    const outcomes = await Promise.all([
      auth.rotateRefreshToken(raced.refreshToken),
      service.revokeQrLoginSession(secondBrowser.owner, raced.payload.qrSessionId!),
    ]);
    assert.equal(await auth.verifyAccessToken(raced.accessToken), null);
    if (outcomes[0].status === 'ROTATED') assert.equal((await auth.rotateRefreshToken(outcomes[0].refreshToken)).status, 'EXPIRED');
    assert.equal((await service.listQrLoginSessions(secondBrowser.owner)).find(row => row.id === raced.payload.qrSessionId)?.status, 'REVOKED');
    pass('a refresh racing website revocation cannot revive a QR session or extend its lifetime');


    const disabledOwner = await owner();
    const disabledChallenge = await service.createQrLogin(disabledOwner.owner);
    await memory.query('UPDATE institutions SET apps_enabled=false WHERE id=1');
    await assert.rejects(service.createQrLogin(disabledOwner.owner), /Mobile apps are not enabled/);
    await assert.rejects(service.redeemQrLogin(disabledChallenge.qr), /Mobile apps are not enabled/);
    assert.equal((await service.inspectQrLogin(disabledOwner.owner, disabledChallenge.challengeId)).status, 'PENDING');
    await memory.query('UPDATE institutions SET apps_enabled=true WHERE id=1');
    const enabledAgain = await service.redeemQrLogin(disabledChallenge.qr);
    assert.equal(enabledAgain.payload.clientType, 'MOBILE');
    await memory.query('UPDATE institutions SET apps_enabled=false WHERE id=1');
    assert.equal((await heartbeat.GET(mobileHeartbeat(enabledAgain.accessToken))).status, 403);
    await memory.query('UPDATE institutions SET apps_enabled=true WHERE id=1');
    pass('Apps disabled prevents QR generation/redemption without consuming codes, blocks existing QR heartbeat, and re-enable restores access');

    console.log(`QR login: ${checks} test groups passed using ${fixture.label}. Native device/browser validation is separate.`);
  } finally {
    await memory.close();
    delete (globalThis as typeof globalThis & { __qrLogin?: typeof state }).__qrLogin;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
