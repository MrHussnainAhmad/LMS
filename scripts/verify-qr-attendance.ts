// Isolated script checks: in-memory PostgreSQL, no service, build output, or Docker.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest, NextResponse } from 'next/server';
import { createStudentVerificationToken } from '../src/lib/student-verification-token';
import { pakistanDateKey } from '../src/lib/parent-period';
import type { JWTPayload } from '../src/lib/auth-types';

type Route = { GET: (req: NextRequest, context: object) => Promise<Response>; POST: (req: NextRequest, context: object) => Promise<Response> };

async function main() {
  process.env.JWT_SECRET = 'isolated-qr-attendance-test-secret-32-characters';
  delete process.env.STUDENT_QR_SIGNING_SECRET;
  delete process.env.STUDENT_QR_LEGACY_SECRET;
  const memory = await PGlite.create();
  const state = { db: drizzle(memory), session: { role: 'STAFF', userId: 10, institutionId: 1 } as JWTPayload | null,
    invalidated: [] as number[][], notified: [] as { records: { studentId: number }[] }[], after: [] as (() => Promise<void>)[],
    server: { NextResponse }, limited: false, cacheKeys: [] as string[], versioned: [] as string[], cacheScans: 0 };
  const fixtureGlobal = globalThis as typeof globalThis & { __qrAttendance?: typeof state };
  fixtureGlobal.__qrAttendance = state;
  const mocks: Record<string, string> = {
    'next/server': 'export const NextResponse=globalThis.__qrAttendance.server.NextResponse;export const after=fn=>globalThis.__qrAttendance.after.push(fn);',
    db: 'export const db=globalThis.__qrAttendance.db;',
    auth: 'export const getSessionFromRequest=async()=>globalThis.__qrAttendance.session;export const getSession=getSessionFromRequest;export const getLightSessionFromRequest=getSessionFromRequest;export const getWarmSessionFromRequest=()=>null;',
    'next/cache': 'export const revalidatePath=()=>{};',
    'rate-limit': 'export const withRateLimit=async()=>({success:!globalThis.__qrAttendance.limited,retryAfterSeconds:60});',
    'api-policy': 'export const withApiPolicy=fn=>fn;',
    'security-permissions': 'export const authorizeSecurityPermission=async()=>true;',
    performance: 'export const measurePerformancePhase=async(_key,fn)=>fn();',
    redis: 'export const getCachedOrFetch=async(_key,_ttl,fn)=>fn();export const invalidateStudentAttendanceCaches=async(_inst,ids)=>globalThis.__qrAttendance.invalidated.push(ids);',
    notifications: 'export const createNotification=async()=>{};export const createAttendanceNotifications=async data=>globalThis.__qrAttendance.notified.push(data);',
    'notification-events': 'export const notifyApprovedStudentLeave=async()=>{};',
    'dashboard-response': 'export const serializedJsonResponse=(data,options)=>globalThis.__qrAttendance.server.NextResponse.json(data,options);',
    ioredis: `export class Redis {status='ready';on(){};pipeline(){return {incr(key){globalThis.__qrAttendance.versioned.push(key);return this},expire(){return this},async exec(){return []}}}async unlink(...keys){globalThis.__qrAttendance.cacheKeys.push(...keys)}async *scanStream(){globalThis.__qrAttendance.cacheScans++}}`,
    'tracked-dashboard-cache': 'export class TrackedDashboardCache {}',
  };
  async function load<T>(entry: string, realRedis = false): Promise<T> {
    // Same in-memory loader used by the repository's API regression scripts.
    const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node',
      format: 'cjs', packages: 'external', logLevel: 'silent', plugins: [{ name: 'isolated-qr-attendance',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, args => {
            if (args.kind === 'entry-point') return;
            if (mocks[args.path]) return { path: args.path, namespace: 'fixture' };
            const absolute = args.path.startsWith('@/') ? path.resolve('src', args.path.slice(2))
              : args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : '';
            const key = absolute === path.resolve('src/db') ? 'db'
              : path.dirname(absolute) === path.resolve('src/lib') ? path.basename(absolute).replace(/\.ts$/, '') : '';
            if (key === 'redis' && realRedis) return;
            if (mocks[key]) return { path: key, namespace: 'fixture' };
          });
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
        },
      }] });
    const loadedModule = { exports: {} as T };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(path.resolve('package.json')), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  let checks = 0;
  function check(label: string) { checks++; console.log('PASS ' + label); }
  try {
    await memory.exec(`
      CREATE TYPE attendance_status AS ENUM ('PRESENT','ABSENT','LATE','LEAVE');
      CREATE TABLE institutions (id integer PRIMARY KEY, name text, deleted_at timestamp, status text DEFAULT 'APPROVED', parent_institution_id integer);
      CREATE TABLE classes (id integer PRIMARY KEY, institution_id integer, name text, deleted_at timestamp);
      CREATE TABLE sections (id integer PRIMARY KEY, institution_id integer, class_id integer, class_teacher_id integer, name text, deleted_at timestamp);
      CREATE TABLE staff (id integer PRIMARY KEY, institution_id integer, name text, is_active boolean DEFAULT true, deleted_at timestamp);
      CREATE TABLE institution_admins (id integer PRIMARY KEY, institution_id integer, name text);
      CREATE TABLE leave_requests (id serial PRIMARY KEY,institution_id integer,user_role text,user_id integer,reason text,
        start_date date,end_date date,parent_phone text,status text DEFAULT 'PENDING',reviewed_by integer,reviewed_at timestamp,created_at timestamp DEFAULT now());
      CREATE TABLE students (id integer PRIMARY KEY, institution_id integer, section_id integer, class_id integer, campus_id integer,
        name text, created_at timestamp NOT NULL, is_active boolean DEFAULT true, academic_status text DEFAULT 'ACTIVE',
        deleted_at timestamp, login_roll_number text, profile_picture_url text, class_roll_number text, year_of_joining integer);
      CREATE TABLE attendances (id serial PRIMARY KEY, institution_id integer NOT NULL, section_id integer NOT NULL,
        student_id integer NOT NULL, date date NOT NULL, status attendance_status NOT NULL, created_at timestamp DEFAULT now(),
        UNIQUE (student_id,date));
      INSERT INTO institutions (id,name) VALUES (1,'School One'),(2,'School Two');
      INSERT INTO classes (id,institution_id,name) VALUES (1,1,'Class One'),(2,2,'Other School');
      INSERT INTO sections (id,institution_id,class_id,class_teacher_id,name) VALUES (1,1,1,10,'A'),(2,1,1,11,'B'),(3,2,2,12,'C');
      INSERT INTO staff (id,institution_id,name,is_active) VALUES (10,1,'Regular Incharge',true),(11,1,'Substitute Teacher',true),(12,2,'Other School Teacher',true),(13,1,'Inactive Teacher',false);
      INSERT INTO institution_admins VALUES (20,1,'School Admin');
      INSERT INTO students (id,institution_id,section_id,class_id,name,created_at,login_roll_number,class_roll_number,year_of_joining) VALUES
        (1,1,1,1,'First Student','2026-01-01','one@school','1',2026),
        (2,1,1,1,'Second Student','2026-01-01','two@school','2',2026),
        (3,1,1,1,'Third Student','2026-01-01','three@school','3',2026),
        (4,1,2,1,'Other Section','2026-01-01','four@school','4',2026),
        (5,2,3,2,'Other Institution','2026-01-01','five@school','5',2026),
        (6,1,1,1,'Inactive Student','2026-01-01','six@school','6',2026),
        (7,1,1,1,'Deleted Student','2026-01-01','seven@school','7',2026),
        (8,1,1,1,'Graduate Student','2026-01-01','eight@school','8',2026);
      UPDATE students SET is_active=false WHERE id=6;
      UPDATE students SET deleted_at=now() WHERE id=7;
      UPDATE students SET academic_status='GRADUATED' WHERE id=8;
    `);
    const migration = readFileSync('drizzle/0088_attendance_delegation.sql', 'utf8');
    await memory.exec(migration);
    await memory.exec(migration);
    check('additive attendance migration is repeatable and preserves existing tables');
    const route = await load<Route>('src/app/api/staff/attendance/qr/route.ts');
    const manual = await load<Route>('src/app/api/staff/attendance/route.ts');
    const admin = await load<Route>('src/app/api/institution/attendance/route.ts');
    const delegation = await load<Route>('src/app/api/institution/attendance/delegation/route.ts');
    const actions = await load<typeof import('../src/app/actions/staff-actions')>('src/app/actions/staff-actions.ts');
    const leaves = await load<{ PATCH: (req: NextRequest, context: object) => Promise<Response> }>('src/app/api/staff/leaves/[id]/route.ts');
    const publicRoute = await load<Route>('src/app/api/public/student-verification/route.ts');
    const today = pakistanDateKey();
    const createdAt = new Date('2026-01-01T00:00:00Z');
    function card(id: number, institutionId = 1, created = createdAt) {
      return 'https://nisaab360.app/verify/student?token=' + createStudentVerificationToken(id, institutionId, created);
    }
    async function get(sectionId = 1) {
      return route.GET(new NextRequest(`http://fixture/api/staff/attendance/qr?sectionId=${sectionId}`), {});
    }
    async function post(input: object) {
      return route.POST(new NextRequest('http://fixture/api/staff/attendance/qr', { method: 'POST',
        body: JSON.stringify({ sectionId: 1, date: today, ...input }), headers: { 'Content-Type': 'application/json' } }), {});
    }
    async function rows() { return (await memory.query<{ student_id: number; status: string }>('SELECT student_id,status FROM attendances ORDER BY student_id')).rows; }
    async function flushAfter() { for (const fn of state.after.splice(0)) await fn(); }

    state.session = null;
    assert.equal((await post({ action: 'scan', qr: card(1) })).status, 401);
    state.session = { role: 'STUDENT', userId: 1, institutionId: 1 };
    assert.equal((await get()).status, 403);
    state.session = { role: 'STAFF', userId: 11, institutionId: 1 };
    assert.equal((await get()).status, 403);
    assert.equal((await post({ action: 'finalize' })).status, 403);
    state.session = { role: 'STAFF', userId: 10, institutionId: 2 };
    assert.equal((await post({ action: 'scan', qr: card(1) })).status, 403);
    state.session = { role: 'STAFF', userId: 10, institutionId: 1 };
    check('unauthenticated, wrong-role, wrong-teacher and cross-tenant access rejected');

    assert.equal((await get(0)).status, 400);
    assert.equal((await post({ action: 'scan', qr: 'not-a-card' })).status, 400);
    assert.equal((await post({ action: 'scan', qr: card(5, 2) })).status, 400);
    assert.equal((await post({ action: 'scan', qr: card(4) })).status, 404);
    for (const id of [6, 7, 8]) assert.equal((await post({ action: 'scan', qr: card(id) })).status, 404);
    assert.equal((await post({ action: 'scan', qr: card(1, 1, new Date('2025-01-01')) })).status, 404);
    const tampered = new URL(card(1));
    tampered.searchParams.set('token', 'A'.repeat(43));
    assert.equal((await post({ action: 'scan', qr: tampered.toString() })).status, 400);
    assert.equal((await post({ action: 'scan', qr: card(1) + '&token=duplicate' })).status, 400);
    assert.equal((await post({ action: 'scan', qr: card(1).replace('/verify/student', '/other') })).status, 400);
    assert.equal((await post({ action: 'scan', qr: card(1), date: '2000-01-01' })).status, 409);
    assert.equal((await post({ action: 'scan', qr: 'x'.repeat(3000) })).status, 413);
    state.limited = true;
    assert.equal((await post({ action: 'scan', qr: card(1) })).status, 429);
    state.limited = false;
    assert.equal((await rows()).length, 0);
    check('invalid, tampered, stale, inactive, graduated, deleted, wrong-section cards and oversized/rate-limited requests rejected');

    assert.equal(pakistanDateKey('2026-10-26T19:01:00Z'), '2026-10-27');
    assert.equal(pakistanDateKey('2026-10-26T18:59:00Z'), '2026-10-26');
    assert.deepEqual(await (await get()).json(), { date: today, total: 3, presentStudentIds: [] });
    check('Pakistan midnight and eligible-only scanner roster');

    const verification = await publicRoute.GET(new NextRequest('http://fixture/api/public/student-verification?token=' + new URL(card(1)).searchParams.get('token')), {});
    assert.equal((await verification.json()).verified, true);
    assert.equal((await rows()).length, 0);
    check('normal QR verification still verifies without marking attendance');

    assert.equal((await (await post({ action: 'scan', qr: card(1) })).json()).alreadyPresent, false);
    await flushAfter();
    assert.equal(state.notified.length, 1);
    assert.deepEqual(state.notified[0].records.map(record => record.studentId), [1]);
    state.notified.length = 0;
    const firstRow = (await memory.query('SELECT id,created_at FROM attendances WHERE student_id=1')).rows[0];
    const invalidations = state.invalidated.length;
    assert.equal((await (await post({ action: 'scan', qr: card(1) })).json()).alreadyPresent, true);
    assert.deepEqual((await memory.query('SELECT id,created_at FROM attendances WHERE student_id=1')).rows[0], firstRow);
    assert.equal(state.invalidated.length, invalidations);
    assert.equal(state.after.length, 0);
    const partial = await (await manual.GET(new NextRequest('http://fixture/api/staff/attendance?view=mark&sectionId=1'), {})).json();
    assert.equal(partial.alreadyMarkedToday, false);
    assert.equal(partial.students.find((student: { id: number }) => student.id === 1).status, 'PRESENT');
    check('first scan persists; duplicate is a no-op with no cache/notification work; partial roster remains usable');

    assert.equal((await post({ action: 'finalize' })).status, 200);
    assert.deepEqual(await rows(), [{ student_id: 1, status: 'PRESENT' }, { student_id: 2, status: 'ABSENT' }, { student_id: 3, status: 'ABSENT' }]);
    await flushAfter();
    assert.equal(state.notified.length, 1);
    assert.deepEqual(state.notified[0].records.map(record => record.studentId).sort(), [2, 3]);
    const repeat = await (await post({ action: 'finalize' })).json();
    assert.equal(repeat.changed, 0);
    await flushAfter();
    assert.equal(state.notified.length, 1);
    const completed = await (await manual.GET(new NextRequest('http://fixture/api/staff/attendance?view=mark&sectionId=1'), {})).json();
    assert.equal(completed.alreadyMarkedToday, true);
    assert.equal(completed.students.find((student: { id: number }) => student.id === 2).status, 'ABSENT');
    check('All Scanned preserves present, fills absent, notifies only changed absences and is idempotent');

    assert.equal((await (await post({ action: 'scan', qr: card(2) })).json()).alreadyPresent, false);
    await post({ action: 'finalize' });
    assert.equal((await rows())[1].status, 'PRESENT');
    await memory.exec("UPDATE attendances SET status='LATE' WHERE student_id=2; UPDATE attendances SET status='LEAVE' WHERE student_id=3");
    await post({ action: 'scan', qr: card(2) });
    await post({ action: 'finalize' });
    assert.equal((await rows())[1].status, 'PRESENT');
    assert.equal((await rows())[2].status, 'ABSENT');
    check('later scans upgrade absent/late; finalization marks unscanned non-present students absent');

    await memory.exec('TRUNCATE attendances');
    await Promise.all([post({ action: 'scan', qr: card(1) }), post({ action: 'scan', qr: card(1) }), post({ action: 'finalize' })]);
    assert.equal((await rows()).length, 3);
    assert.equal((await rows())[0].status, 'PRESENT');
    await Promise.all([post({ action: 'finalize' }), post({ action: 'scan', qr: card(3) })]);
    assert.equal((await rows())[2].status, 'PRESENT');
    check('overlapping scans/finalizations create one row per student/day and presence wins');

    const adminSession: JWTPayload = { role: 'INSTITUTION_ADMIN', userId: 20, institutionId: 1 };
    const substituteSession: JWTPayload = { role: 'STAFF', userId: 11, institutionId: 1 };
    async function assign(staffId: number | null, date = today, sectionId = 1) {
      return delegation.POST(new NextRequest('http://fixture/api/institution/attendance/delegation', {
        method: 'POST', body: JSON.stringify({ staffId, date, sectionId }), headers: { 'Content-Type': 'application/json' },
      }), {});
    }
    async function manualPost(handler = manual, overrides: object = {}) {
      return handler.POST(new NextRequest('http://fixture/api/staff/attendance', { method: 'POST',
        body: JSON.stringify({ sectionId: 1, date: today, records: [{ studentId: 1, status: 'LATE' }], ...overrides }),
        headers: { 'Content-Type': 'application/json' },
      }), {});
    }
    state.session = substituteSession;
    assert.equal((await assign(11)).status, 403);
    assert.equal((await manualPost()).status, 403);
    await assert.rejects(() => actions.submitAttendanceAction(1, new Date(`${today}T12:00:00+05:00`), [{ studentId: 1, status: 'PRESENT' }]));
    state.session = adminSession;
    assert.equal((await assign(12)).status, 400);
    assert.equal((await assign(13)).status, 400);
    assert.equal((await assign(11, '2000-01-01')).status, 400);
    assert.equal((await assign(11, today, 3)).status, 404);
    assert.equal((await assign(11, '2099-01-01')).status, 200);
    state.session = substituteSession;
    assert.equal((await get()).status, 403);
    assert.equal((await manualPost({ ...manual }, { date: '2099-01-01' })).status, 409);
    state.session = adminSession;
    assert.equal((await assign(11)).status, 200);
    state.session = substituteSession;
    const assigned = await (await manual.GET(new NextRequest('http://fixture/api/staff/attendance?view=mark'), {})).json();
    assert.ok(assigned.assignedSections.some((section: { id: number }) => section.id === 1));
    assert.equal((await get()).status, 200);
    assert.equal((await manualPost()).status, 200);
    assert.equal((await manualPost(manual, { date: `${today}T00:00:00.000Z` })).status, 200);
    await actions.submitAttendanceAction(1, new Date(`${today}T12:00:00+05:00`), [{ studentId: 2, status: 'LEAVE' }]);
    let attribution = (await memory.query<{ marked_by_id: number; marked_by_role: string; marked_by_name: string; marked_at?: Date }>('SELECT marked_by_id,marked_by_role,marked_by_name,marked_at FROM attendances WHERE student_id=2')).rows[0];
    assert.equal(attribution.marked_by_id, 11);
    assert.equal(attribution.marked_by_name, 'Substitute Teacher');
    assert.equal(attribution.marked_by_role, 'STAFF');
    assert.ok(attribution.marked_at);
    assert.equal((await post({ action: 'scan', qr: card(2) })).status, 200);
    assert.equal((await post({ action: 'finalize' })).status, 200);
    assert.equal((await manualPost(manual, { records: [{ studentId: 4, status: 'PRESENT' }] })).status, 400);
    assert.equal((await manualPost(manual, { records: [{ studentId: 5, status: 'PRESENT' }] })).status, 400);
    assert.equal((await manualPost(manual, { records: [{ studentId: 6, status: 'PRESENT' }] })).status, 400);
    assert.equal((await manualPost(manual, { records: [{ studentId: 1, status: 'PRESENT' }, { studentId: 1, status: 'ABSENT' }] })).status, 400);
    assert.equal((await manualPost(manual, { records: [] })).status, 400);
    check('date-limited substitutes appear on rosters and can mark via web action, manual API and QR with recorded identity; invalid rosters rejected');

    state.session = adminSession;
    assert.equal((await assign(null)).status, 200);
    state.session = substituteSession;
    assert.equal((await get()).status, 403);
    assert.equal((await manualPost()).status, 403);
    await assert.rejects(() => actions.submitAttendanceAction(1, new Date(`${today}T12:00:00+05:00`), [{ studentId: 1, status: 'PRESENT' }]));
    state.session = { role: 'STAFF', userId: 10, institutionId: 1 };
    assert.equal((await get()).status, 200);
    assert.equal((await manualPost()).status, 200);
    assert.equal((await memory.query<{ class_teacher_id: number }>('SELECT class_teacher_id FROM sections WHERE id=1')).rows[0].class_teacher_id, 10);
    state.session = adminSession;
    assert.equal((await assign(11)).status, 200);
    await memory.exec("UPDATE attendance_delegations SET date='2000-01-01' WHERE section_id=1 AND date='" + today + "'");
    state.session = substituteSession;
    assert.equal((await get()).status, 403);
    assert.equal((await manualPost()).status, 403);
    check('revocation and expired assignments remove access immediately while regular incharge remains unchanged');

    state.session = adminSession;
    assert.equal((await manualPost(admin)).status, 200);
    attribution = (await memory.query<typeof attribution>('SELECT marked_by_id,marked_by_role,marked_by_name FROM attendances WHERE student_id=1')).rows[0];
    assert.deepEqual(attribution, { marked_by_id: 20, marked_by_role: 'INSTITUTION_ADMIN', marked_by_name: 'School Admin' });
    assert.equal((await manualPost(admin, { sectionId: 3, records: [{ studentId: 5, status: 'PRESENT' }] })).status, 404);
    state.session = { role: 'INSTITUTION', userId: 1, institutionId: 1 };
    assert.equal((await manualPost(admin)).status, 200);
    state.session = { ...adminSession, campusReadOnly: true };
    assert.equal((await manualPost(admin)).status, 403);
    assert.equal((await assign(11)).status, 403);
    state.session = { ...adminSession, mustChangePassword: true };
    assert.equal((await manualPost(admin)).status, 403);
    state.session = substituteSession;
    assert.equal((await manualPost(admin)).status, 403);
    check('institution owner/admin fallback is audited and rejects foreign institutions, staff, read-only campuses and password-change sessions');

    await memory.exec("INSERT INTO leave_requests (id,institution_id,user_role,user_id,reason,start_date,end_date) VALUES (1,1,'STUDENT',1,'Medical leave','" + today + "','" + today + "')");
    const approveLeave = () => leaves.PATCH(new NextRequest('http://fixture/api/staff/leaves/1', { method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }), headers: { 'Content-Type': 'application/json' },
    }), { params: Promise.resolve({ id: '1' }) });
    assert.equal((await approveLeave()).status, 403);
    state.session = { role: 'STAFF', userId: 10, institutionId: 1 };
    assert.equal((await approveLeave()).status, 200);
    assert.deepEqual((await memory.query('SELECT status,marked_by_id,marked_by_name FROM attendances WHERE student_id=1')).rows[0],
      { status: 'LEAVE', marked_by_id: 10, marked_by_name: 'Regular Incharge' });
    check('leave approval keeps its existing incharge restriction and records the actual attendance updater');

    const cache = await load<typeof import('../src/lib/redis')>('src/lib/redis.ts', true);
    await cache.invalidateStudentAttendanceCaches(1, [1, 1], { staffId: 10, sectionId: 1, date: today, campusId: 4 });
    assert.deepEqual(state.versioned, ['cache:student:attendance:version:1']);
    assert.ok(state.cacheKeys.includes(`cache:staff:attendance:mark:1:10:1:${today}`));
    assert.ok(state.cacheKeys.includes(`cache:staff:attendance:mark:1:10:auto:${today}`));
    assert.ok(state.cacheKeys.includes(`cache:staff:attendance:history:1:10:${today}:all`));
    assert.ok(state.cacheKeys.includes(`cache:dashboard:today-attendance:1:${today}`));
    assert.equal(state.cacheScans, 0);
    check('scan cache invalidation uses exact student/teacher/dashboard keys with no Redis keyspace scan');
    console.log(`QR attendance: ${checks} groups passed. No application builds or Docker tests run.`);
  } finally { await memory.close(); delete fixtureGlobal.__qrAttendance; }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
