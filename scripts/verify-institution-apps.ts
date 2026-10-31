// Disposable PostgreSQL fixture. No .env, production database, app build or network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { hash, verify } from '@node-rs/argon2';
import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '../src/lib/auth-types';

async function main() {
  process.env.JWT_SECRET = 'isolated-institution-apps-test-secret-32-characters';
  const memory = await PGlite.create();
  const state = { db: drizzle(memory), cookies: new Map<string, string>(), audit: [] as unknown[], server: { NextResponse }, verify };
  (globalThis as typeof globalThis & { __apps?: typeof state }).__apps = state;
  const mocks: Record<string, string> = {
    db: 'export const db=globalThis.__apps.db;',
    'next/server': 'export const NextResponse=globalThis.__apps.server.NextResponse;export const after=()=>{};',
    'next/headers': `export const cookies=async()=>({get:key=>{const value=globalThis.__apps.cookies.get(key);return value?{value}:undefined},set:(key,value)=>globalThis.__apps.cookies.set(key,value),delete:key=>globalThis.__apps.cookies.delete(key)});export const headers=async()=>new Headers({host:'localhost:3000'});`,
    redis: `export const redis={status:'end',get:async()=>null,setex:async()=>{}};`,
    user: 'export const getFreshStudent=async()=>({id:1});export const verifyUserExistsFresh=async()=>true;export const getUserCreatedAt=async()=>new Date();',
    'auth-student': 'export const enrichFreshStudentSession=x=>x;',
    'campus-workspaces': 'export const resolveCampusSession=async x=>x;',
    'notification-events': 'export const notifySecurity=async()=>{};',
    audit: 'export const logAudit=async data=>globalThis.__apps.audit.push(data);',
    'argon2-pool': 'export const verifyPassword=(...args)=>globalThis.__apps.verify(...args);',
    'rate-limit': 'export const withRateLimit=async()=>({success:true});export const withPlatformLoginRateLimit=withRateLimit;',
    cors: 'export const applyCorsHeaders=(_req,response)=>response;',
  };
  async function load<T>(entry: string): Promise<T> {
    const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', plugins: [{ name: 'apps-fixture', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (args.kind === 'entry-point') return;
        const absolute = args.path.startsWith('@/') ? path.resolve('src', args.path.slice(2)) : args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : '';
        const key = absolute === path.resolve('src/db') ? 'db' : path.dirname(absolute) === path.resolve('src/lib') ? path.basename(absolute).replace(/\.ts$/, '') : args.path;
        if (mocks[key]) return { path: key, namespace: 'fixture' };
      });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
    } }] });
    const fixtureModule = { exports: {} as T };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(path.resolve('package.json')), fixtureModule, fixtureModule.exports);
    return fixtureModule.exports;
  }
  let groups = 0;
  const pass = (message: string) => { groups++; console.log('PASS ' + message); };
  try {
    await memory.exec(`
      CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','EMPLOYEE','INSTITUTION','INSTITUTION_ADMIN','STAFF','STUDENT','PARENT');
      CREATE TABLE institutions(id integer PRIMARY KEY,status text DEFAULT 'APPROVED',deleted_at timestamp,parent_institution_id integer,
        username text,public_slug text,public_site_enabled boolean DEFAULT true,allow_graduated_student_access boolean DEFAULT false);
      CREATE TABLE refresh_tokens(id serial PRIMARY KEY,user_role user_role,user_id integer,token_hash text UNIQUE,qr_session_id varchar(36),
        expires_at timestamp,revoked_at timestamp,replaced_by_hash text,reuse_detected_at timestamp,created_at timestamp DEFAULT now());
      CREATE TABLE qr_login_sessions(id varchar(36) PRIMARY KEY,user_role user_role,user_id integer,institution_id integer,device_name text,
        created_at timestamptz DEFAULT now(),expires_at timestamptz,revoked_at timestamptz);
      CREATE TABLE push_devices(id serial PRIMARY KEY,session_token_hash varchar(64),updated_at timestamptz,revoked_at timestamptz);
      CREATE TABLE students(id integer PRIMARY KEY,institution_id integer,password_hash text,is_active boolean DEFAULT true,deleted_at timestamp,
        must_change_password boolean DEFAULT false,academic_status text DEFAULT 'ACTIVE',login_roll_number text,created_at timestamp DEFAULT now());
      CREATE TABLE staff(id integer PRIMARY KEY,institution_id integer,password_hash text,is_active boolean DEFAULT true,deleted_at timestamp,
        must_change_password boolean DEFAULT false,campus_id integer,email text,created_at timestamp DEFAULT now());
      CREATE TABLE parent_accounts(id integer PRIMARY KEY,institution_id integer,password_hash text,status text DEFAULT 'ACTIVE',deleted_at timestamp,
        must_change_password boolean DEFAULT false,email text,created_at timestamp DEFAULT now());
      CREATE TABLE account_lockouts(id serial PRIMARY KEY,user_role user_role,user_id integer,locked_until timestamp,failed_count integer DEFAULT 0,
        window_started_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
      INSERT INTO institutions(id,username,public_slug,parent_institution_id)VALUES(1,'ncs','ncs',NULL),(2,'other','other',NULL),(3,'campus','campus',1);
    `);
    const migration = readFileSync('drizzle/0081_institution_mobile_apps.sql', 'utf8');
    await memory.exec(migration); await memory.exec(migration);
    await memory.exec("ALTER TABLE institutions ADD COLUMN pricing_plan varchar(20) NOT NULL DEFAULT 'BASIC'");
    await memory.exec(readFileSync('drizzle/0082_institution_agreement_acceptance.sql', 'utf8'));
    await memory.exec(readFileSync('drizzle/0083_admin_managed_plans.sql', 'utf8'));
    await memory.exec(readFileSync('drizzle/0086_security_sessions.sql', 'utf8'));
    assert.ok((await memory.query<{ apps_enabled: boolean }>('SELECT apps_enabled FROM institutions')).rows.every(row => row.apps_enabled));
    assert.match(readFileSync('scripts/migrate-production.mjs', 'utf8'), /0081_institution_mobile_apps\.sql/);
    pass('forward migration is idempotent and preserves existing institutions with Apps enabled');
    const password = 'Isolated-mobile-app-password!42'; const encoded = await hash(password);
    await memory.query("INSERT INTO students(id,institution_id,password_hash,login_roll_number)VALUES(1,1,$1,'2s26-0001@ncs.nisaab360.app')", [encoded]);
    await memory.query("INSERT INTO staff(id,institution_id,password_hash,email)VALUES(10,1,$1,'teacher@ncs.nisaab360.app')", [encoded]);
    await memory.query("INSERT INTO parent_accounts(id,institution_id,password_hash,email)VALUES(20,1,$1,'parent@example.test')", [encoded]);
    const auth = await load<typeof import('../src/lib/auth')>('src/lib/auth.ts');
    const gate = await load<typeof import('../src/lib/mobile-app-access')>('src/lib/mobile-app-access.ts');
    const login = await load<typeof import('../src/app/api/auth/login/route')>('src/app/api/auth/login/route.ts');
    const refresh = await load<typeof import('../src/app/api/auth/refresh/route')>('src/app/api/auth/refresh/route.ts');
    const setting = await load<typeof import('../src/app/api/employee/institutions/[id]/apps/route')>('src/app/api/employee/institutions/[id]/apps/route.ts');
    const req = (url: string, body: unknown, token?: string, extra: Record<string, string> = {}) => new NextRequest('http://localhost:3000' + url, {
      method: url.includes('/apps') ? 'PATCH' : 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body),
    });
    const context = { params: Promise.resolve({ id: '1' }) };
    const admin = await auth.createTokens({ role: 'SUPER_ADMIN', userId: 99, isSuperAdmin: false });
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: false }, admin.accessToken), context)).status, 200);
    assert.equal((await memory.query<{ public_site_enabled: boolean }>('SELECT public_site_enabled FROM institutions WHERE id=1')).rows[0].public_site_enabled, true);
    for (const role of ['STUDENT','STAFF','PARENT','INSTITUTION','INSTITUTION_ADMIN'] as UserRole[]) {
      const token = await auth.createTokens({ role, userId: 1, institutionId: 2 });
      assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: true }, token.accessToken), context)).status, 403);
    }
    const employee = await auth.createTokens({ role: 'EMPLOYEE', userId: 98 });
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: true }, employee.accessToken), context)).status, 200);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: 'false' }, admin.accessToken), context)).status, 400);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: false, publicSiteEnabled: false }, admin.accessToken), context)).status, 400);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: true }), context)).status, 401);
    state.cookies.set('access_token', admin.accessToken);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: false }, undefined, { origin: 'https://evil.test', cookie: `access_token=${admin.accessToken}` }), context)).status, 403);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: false }, undefined, { origin: 'https://evil.test', cookie: `access_token=${admin.accessToken}`, authorization: 'invalid' }), context)).status, 403);
    assert.equal((await setting.PATCH(req('/api/employee/institutions/1/apps', { appsEnabled: true }, undefined, { origin: 'http://localhost:3000', cookie: `access_token=${admin.accessToken}` }), context)).status, 200);
    state.cookies.clear();
    assert.equal(state.audit.length, 3);
    pass('platform Admin and Employee can toggle; school accounts cannot; CSRF, strict validation and audit are enforced without changing website publication');
    const cases = [
      ['STUDENT', 1, '2s26-0001@ncs.nisaab360.app'], ['STAFF', 10, 'teacher@ncs.nisaab360.app'], ['PARENT', 20, 'parent@example.test'],
    ] as const;
    for (const [role, id, identifier] of cases) {
      const body = { emailOrUsername: identifier, password, roleHint: role, ...(role === 'PARENT' ? { institutionUsername: 'ncs' } : {}) };
      await memory.exec('UPDATE institutions SET apps_enabled=true WHERE id=1');
      const response = await login.POST(req('/api/auth/login', { ...body, returnTokens: true }));
      assert.equal(response.status, 200, `${role} mobile login`);
      const tokens = await response.json(); assert.equal((await auth.verifyAccessToken(tokens.accessToken))?.clientType, 'MOBILE');
      const bearer = new NextRequest('http://localhost:3000/api/me', { headers: { authorization: `Bearer ${tokens.accessToken}` } });
      assert.ok(await auth.getSessionFromRequest(bearer));
      const existingWeb = await auth.createTokens({ role, userId: id, institutionId: 1 });
      await memory.exec('UPDATE institutions SET apps_enabled=false WHERE id=1');
      const denied = await login.POST(req('/api/auth/login', { ...body, returnTokens: true }));
      assert.equal(denied.status, 403); assert.equal((await denied.json()).code, 'MOBILE_APPS_DISABLED');
      assert.equal(await auth.getSessionFromRequest(bearer), null);
      assert.equal(await auth.getLightSessionFromRequest(bearer), null);
      assert.equal(await auth.getSessionFromRequest(new NextRequest('http://localhost:3000/api/me', { headers: { cookie: `access_token=${tokens.accessToken}` } })), null);
      const deniedRefresh = await refresh.POST(req('/api/auth/refresh', { refreshToken: tokens.refreshToken }));
      assert.equal(deniedRefresh.status, 403);
      assert.ok(await auth.getSessionFromRequest(new NextRequest('http://localhost:3000/api/me', { headers: { cookie: `access_token=${existingWeb.accessToken}` } })));
      state.cookies.set('refresh_token', existingWeb.refreshToken);
      assert.equal((await refresh.POST(req('/api/auth/refresh', {}))).status, 200, 'Existing web refresh survives app disable');
      const web = await login.POST(req('/api/auth/login', { ...body, returnTokens: false })); assert.equal(web.status, 200);
      const webAccess = state.cookies.get('access_token')!;
      assert.ok(await auth.getSessionFromRequest(new NextRequest('http://localhost:3000/api/me', { headers: { cookie: `access_token=${webAccess}` } })));
      const webRefresh = await refresh.POST(req('/api/auth/refresh', {})); assert.equal(webRefresh.status, 200);
      assert.equal(await gate.mobileAppAccessAllowed({ role, institutionId: 2 }, true), true);
      pass(`${role}: password/native token and existing app sessions blocked when disabled; website login, cookies and refresh still work; other institution isolated`);
    }
    assert.equal(await gate.mobileAppAccessAllowed({ role: 'STUDENT', institutionId: 3 }, true), false);
    await memory.exec('UPDATE institutions SET apps_enabled=true WHERE id=1');
    assert.equal(await gate.mobileAppAccessAllowed({ role: 'STUDENT', institutionId: 3 }, true), true);
    await memory.exec('UPDATE institutions SET apps_enabled=false WHERE id=3');
    assert.equal(await gate.mobileAppAccessAllowed({ role: 'PARENT', institutionId: 3 }, true), false);
    const legacy = await auth.createTokens({ role: 'STAFF', userId: 10, institutionId: 1 });
    const upgraded = await refresh.POST(req('/api/auth/refresh', { refreshToken: legacy.refreshToken })); assert.equal(upgraded.status, 200);
    const upgradedTokens = await upgraded.json(); assert.equal((await auth.verifyAccessToken(upgradedTokens.accessToken))?.clientType, 'MOBILE');
    assert.equal((await auth.rotateRefreshToken(upgradedTokens.refreshToken)).status, 'ROTATED');
    const types = await memory.query<{ client_type: string }>("SELECT client_type FROM refresh_tokens WHERE user_role='STAFF' AND revoked_at IS NULL");
    assert.ok(types.rows.some(row => row.client_type === 'MOBILE'));
    pass('campuses inherit a disabled root; individual campuses can be disabled; legacy native refresh upgrades and rotation preserves client type');
    for (const file of ['src/app/(superadmin)/sa/institutions/[id]/page.tsx','src/app/(employee)/employee/institutions/[id]/page.tsx']) assert.match(readFileSync(file, 'utf8'), /<InstitutionAppsControl/);
    console.log(`Institution Apps: ${groups} SQL/HTTP regression groups passed. No mobile projects changed.`);
  } finally { await memory.close(); delete (globalThis as typeof globalThis & { __apps?: unknown }).__apps; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
