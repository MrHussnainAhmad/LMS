import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import { SQL, eq } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { NextRequest } from 'next/server';
import * as schema from '../src/db/schema';
import type { BatchExamReport } from '../src/lib/batch-exams';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function main() {
  process.env.JWT_SECRET = 'mobile-parity-isolated-test-secret-at-least-32-characters';
  const memory = await PGlite.create();
  const readQueries: string[] = [];
  const db = drizzle(memory, { logger: { logQuery(query) { if (/^select\b/i.test(query)) readQueries.push(query); } } });
  const state: any = {
    db,
    session: null,
    headers: new Headers(),
    valid: true,
    cookieToken: null,
    notified: [],
    invalidated: [],
    refreshedKeys: [],
  };
  (globalThis as any).__mobileParity = state;
  const mocks: Record<string, string> = {
    'server-only': 'export {};',
    db: 'export const db=globalThis.__mobileParity.db;',
    auth: 'export const revokeAllSessions=async()=>{};export const getSession=async()=>globalThis.__mobileParity.session; export const getSessionFromRequest=getSession;export const getLightSessionFromRequest=getSession;',
    'next/headers':
      'export const headers=async()=>globalThis.__mobileParity.headers;export const cookies=async()=>({get:key=>key==="access_token"&&globalThis.__mobileParity.cookieToken?{value:globalThis.__mobileParity.cookieToken}:undefined});',
    'next/cache': 'export const revalidatePath=()=>{};',
    'rate-limit': 'export const withRateLimit=async()=>({success:true});export const withUploadGrantLimit=async()=>({success:true});',
    'api-policy': 'export const withApiPolicy=fn=>fn;',
    performance: 'export const measurePerformancePhase=async(_key,fn)=>fn();',
    'campus-workspaces': 'export const resolveCampusSession=async session=>session;',
    user: 'export const verifyUserExistsFresh=async()=>globalThis.__mobileParity.valid;export const getFreshStudent=async()=>globalThis.__mobileParity.valid?{academicStatus:"ACTIVE"}:null;export const getUserCreatedAt=async()=>new Date("2020-01-01");',
    redis:
      'export const invalidateReadCacheKeys=async()=>{};export const invalidateReadCachePatterns=async()=>{};export const invalidateTimetableReadCaches=async()=>{};export const invalidateStudentEnrichCache=async()=>{};export const invalidateStudentAttendanceCaches=async()=>{};export const invalidateStudentMarksCaches=async(...args)=>globalThis.__mobileParity.invalidated.push(args);export const invalidateInstitutionRosterCaches=async()=>{};export const invalidateAnnouncementReadCaches=async()=>{};export const getCachedOrFetch=async(key,_ttl,fn,_decode,force)=>{if(force)globalThis.__mobileParity.refreshedKeys.push(key);return fn()};',
    notifications:
      'export const createAttendanceNotifications=async()=>{};export const createBulkNotifications=async()=>{};export const processAnnouncementNotification=async id=>globalThis.__mobileParity.notified.push(id);',
    'notification-events': 'export const notifyPublishedResults=async()=>{};export const notifyTimetable=async()=>{};export const notifyAssignment=async()=>{};export const notifyBatchResults=async()=>{};export const notifyApprovedStudentLeave=async()=>{};export const notifySecurity=async()=>{};',
    'notification-delivery': 'export const createNotification=async()=>{};export const createBulkNotifications=async()=>[];',
    // Product entitlements and notification delivery have dedicated SQL suites.
    'mobile-app-access': 'export const mobileAppAccessAllowed=async()=>true;export const isMobileRole=role=>["STUDENT","STAFF","PARENT"].includes(role);',
    cloudinary:
      'export default {api:{resource:async()=>({type:"authenticated",format:"png",bytes:100})},utils:{api_sign_request:()=>"fixture-signature"}};',
  };
  async function load(entry: string, realAuth = false) {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      logLevel: 'silent',
      plugins: [
        {
          name: 'isolated-mobile',
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === 'entry-point') return;
              if (mocks[args.path]) return { path: args.path, namespace: 'fixture' };
              const absolute = args.path.startsWith('@/')
                ? path.resolve('src', args.path.slice(2))
                : args.path.startsWith('.')
                  ? path.resolve(args.resolveDir, args.path)
                  : '';
              const key =
                absolute === path.resolve('src/db')
                  ? 'db'
                  : path.dirname(absolute) === path.resolve('src/lib')
                    ? path.basename(absolute).replace(/\.ts$/, '')
                    : '';
              if (key === 'auth' && realAuth) return;
              if (mocks[key]) return { path: key, namespace: 'fixture' };
            });
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
              contents: mocks[args.path],
              loader: 'js',
              resolveDir: process.cwd(),
            }));
          },
        },
      ],
    });
    const loadedModule = { exports: {} as any };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(
      createRequire(path.resolve('package.json')),
      loadedModule,
      loadedModule.exports,
    );
    return loadedModule.exports;
  }
  const checks: string[] = [];
  const check = (label: string) => {
    checks.push(label);
    console.log('PASS ' + label);
  };
  try {
    const dialect = new PgDialect();
    const tables = [
      schema.academicSessions,
      schema.announcementReads,
      schema.studentFeeAdjustments,
      schema.assignments,
      schema.submissions,
      schema.institutions,
      schema.institutionPaymentGateways,
      schema.gatewayPaymentAttempts,
      schema.planDeviceSessions,
      schema.classes,
      schema.sections,
      schema.subjects,
      schema.students,
      schema.staff,
      schema.attendances,
      schema.diaries,
      schema.leaveRequests,
      schema.tickets,
      schema.staffAssignments,
      schema.tests,
      schema.marks,
      schema.announcements,
      schema.campuses,
      schema.parentAccounts,
      schema.parentStudents,
      schema.feeInvoices,
      schema.feeInvoiceItems,
      schema.feePayments,
      schema.feePaymentSubmissions,
      schema.admissionFeeProofs,
      schema.onlineTests,
      schema.onlineTestQuestions,
      schema.onlineTestSubmissions,
      schema.batchExams,
      schema.batchExamSubjects,
      schema.batchExamResults,
      schema.gradingScales,
      schema.auditLogs,
      schema.studentPromotions,
    ];
    for (const table of tables) {
      const config = getTableConfig(table);
      const columns = config.columns.map((column) => {
        let def = '';
        if (column.default !== undefined) {
          const value = column.default;
          def =
            ' DEFAULT ' +
            (value instanceof SQL
              ? dialect.sqlToQuery(value).sql
              : typeof value === 'string'
                ? `'${value.replaceAll("'", "''")}'`
                : typeof value === 'object'
                  ? `'${JSON.stringify(value)}'::jsonb`
                  : String(value));
        }
        return `"${column.name}" ${column.columnType === 'PgEnumColumn' ? 'text' : column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${def}`;
      });
      await memory.exec(`CREATE TABLE "${config.name}" (${columns.join(',')})`);
    }
    await memory.exec('CREATE UNIQUE INDEX fixture_marks_unique ON marks(test_id,student_id)');
    async function seed(table: any, values: any) {
      const fallback: any = {};
      for (const [key, col] of Object.entries(table) as [string, any][]) {
        if (!col?.notNull || col.columnType === 'PgSerial' || col.default !== undefined || key in values)
          continue;
        fallback[key] =
          col.dataType === 'number'
            ? 1
            : col.dataType === 'boolean'
              ? false
              : col.dataType === 'date'
                ? new Date('2026-10-01')
                : col.dataType === 'json'
                  ? {}
                  : col.getSQLType?.() === 'date'
                    ? '2026-10-01'
                    : col.getSQLType?.() === 'time'
                      ? '09:00:00'
                      : 'fixture';
      }
      await db.insert(table).values({ ...fallback, ...values });
    }
    await seed(schema.institutions, {
      id: 1,
      name: 'Fixture School',
      feePaymentMethods: [
        { id: 'bank1', providerName: 'Bank', accountTitle: 'School', accountNumber: '12345', qrUrl: null },
      ],
    });
    await seed(schema.classes, { id: 1, institutionId: 1, name: 'Class 1' });
    await seed(schema.sections, { id: 1, institutionId: 1, classId: 1, name: 'A' });
    await seed(schema.subjects, { id: 1, institutionId: 1, name: 'Math' });
    for (const id of [1, 2])
      await seed(schema.students, {
        id,
        institutionId: 1,
        classId: 1,
        sectionId: 1,
        name: 'Student ' + id,
        classRollNumber: String(id),
        loginRollNumber: 'login' + id,
        deletedAt: null,
        academicStatus: 'ACTIVE',
      });
    await seed(schema.staffAssignments, {
      id: 1,
      institutionId: 1,
      staffId: 7,
      sectionId: 1,
      subjectId: 1,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
    });
    await seed(schema.tests, {
      id: 1,
      institutionId: 1,
      classId: 1,
      sectionId: 1,
      subjectId: 1,
      staffId: 7,
      createdByRole: 'STAFF',
      type: 'QUIZ',
      title: 'Quiz',
      maxMarks: 10,
      date: '2026-10-10',
      resultsPublishedAt: null,
    });
    state.session = { role: 'STAFF', userId: 7, institutionId: 1 };
    const tools = await load('src/app/api/staff/marks/tools/route.ts');
    const marksRequest = async (action: string, csv?: string, overwrite = false) => {
      const form = new FormData();
      form.append('action', action);
      form.append('testId', '1');
      form.append('sectionId', '1');
      if (csv) form.append('csv', new File([csv], 'marks.csv', { type: 'text/csv' }));
      if (overwrite) form.append('overwrite', 'on');
      return tools.POST(
        new NextRequest('http://localhost/api/staff/marks/tools', { method: 'POST', body: form }),
        {},
      );
    };
    let response = await marksRequest('publish');
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /all 2 students/);
    const csv = 'Roll Number,Student Name,Marks Obtained,Total Marks\n1,Student 1,8,10\n2,Student 2,9,10';
    response = await marksRequest('upload', csv);
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    response = await marksRequest('upload', csv);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /overwrite/);
    response = await marksRequest('upload', csv.replace(',8,10', ',7,10'), true);
    assert.equal(response.status, 200);
    response = await marksRequest('publish');
    assert.equal(response.status, 200);
    assert((await db.select().from(schema.tests))[0].resultsPublishedAt);
    assert.equal(
      (await db.select().from(schema.marks).where(eq(schema.marks.studentId, 1)))[0].marksObtained,
      7,
    );
    check(
      'CSV upload, duplicate rejection, explicit overwrite, complete-roster publication and cache invalidation',
    );
    assert(state.invalidated.length >= 3);
    state.session = { role: 'STAFF', userId: 8, institutionId: 1 };
    response = await marksRequest('publish');
    assert.equal(response.status, 400);
    state.session = { role: 'PARENT', userId: 1, institutionId: 1 };
    assert.equal((await marksRequest('publish')).status, 403);
    state.session = { role: 'STAFF', userId: 7, institutionId: 1, mustChangePassword: true };
    assert.equal((await marksRequest('publish')).status, 403);
    check('Unauthorized teacher, parent and forced-password publication blocked');
    state.session = { role: 'STAFF', userId: 7, institutionId: 1 };
    const announcements = await load('src/app/api/staff/announcements/route.ts');
    const announce = async (body: any) =>
      announcements.POST(
        new NextRequest('http://localhost/api/staff/announcements', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        {},
      );
    assert.equal(
      (
        await announce({
          title: 'Reminder',
          content: 'Bring books',
          targetType: 'SECTION',
          targetClassId: 1,
          targetSectionId: 1,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await announce({
          title: 'No',
          content: 'No',
          targetType: 'SECTION',
          targetClassId: 1,
          targetSectionId: 9,
        })
      ).status,
      400,
    );
    assert.equal((await announce(null)).status, 400);
    assert.equal((await announce({ title: 'Hi' })).status, 400);
    const inbox = await (
      await announcements.GET(new NextRequest('http://localhost/api/staff/announcements'), {})
    ).json();
    assert.equal(inbox.sent.length, 1);
    assert.equal(inbox.sections[0].id, 1);
    assert.equal(state.notified.length, 1);
    check(
      'Teacher announcements use assigned audience, validate input, dispatch notifications and list own sent messages',
    );
    await seed(schema.parentAccounts, {
      id: 1,
      institutionId: 1,
      email: 'parent@example.test',
      isApproved: true,
    });
    await seed(schema.parentStudents, { id: 1, institutionId: 1, parentId: 1, studentId: 1 });
    const portal = await load('src/app/api/parent/portal/route.ts');
    state.session = { role: 'PARENT', userId: 1, institutionId: 1 };
    const freshNotices = await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=notices&student=1&_refresh=fixture'));
    assert.equal(freshNotices.status, 200);
    assert.match(freshNotices.headers.get('Cache-Control') || '', /no-store/);
    assert.ok(state.refreshedKeys.includes('cache:announcements:visible:1:STUDENT:1:30'));
    const forcedReads = state.refreshedKeys.length;
    await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=notices&student=1'));
    assert.equal(state.refreshedKeys.length, forcedReads, 'Ordinary navigation retains normal server caching');
    assert.equal((await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=notices&student=2&_refresh=fixture'))).status, 404);
    assert.equal(state.refreshedKeys.length, forcedReads, 'An unlinked child cannot invalidate another audience cache');
    check('Parent refresh uses private non-cacheable responses and forces only authorized announcement reads');
    readQueries.length = 0;
    const lightweightAccount = await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=account&view=overview&student=1'))).json();
    assert.equal(lightweightAccount.profile, null);
    assert.ok(!readQueries.some(query => /leave_requests|tickets|father_name/.test(query)), 'Closed student records must not query profile/history');
    readQueries.length = 0;
    const profileOnly = await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=profile&student=1'))).json();
    assert.ok(profileOnly.profile);
    assert.ok(!readQueries.some(query => /leave_requests|tickets/.test(query)));
    readQueries.length = 0;
    const requestsOnly = await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=requests&student=1'))).json();
    assert.ok(Array.isArray(requestsOnly.leaves) && Array.isArray(requestsOnly.support));
    assert.ok(!readQueries.some(query => /father_name/.test(query)));
    readQueries.length = 0;
    const homeOverviewResponse = await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=home&view=overview&student=1&_refresh=fixture'));
    assert.equal(homeOverviewResponse.status, 200);
    const homeOverview = await homeOverviewResponse.json();
    assert.ok(homeOverview.summary);
    assert.deepEqual(homeOverview.announcements, []);
    assert.deepEqual(homeOverview.diary, []);
    assert.deepEqual(homeOverview.upcomingTests, []);
    assert.equal(readQueries.length, 2, 'Home overview uses one authorized context read and one aggregate read in this auth fixture');
    assert.ok(!readQueries.some(query => /diaries|announcements/.test(query)));
    const legacyAccount = await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=account&student=1'))).json();
    assert.ok(legacyAccount.profile && Array.isArray(legacyAccount.leaves) && Array.isArray(legacyAccount.support));
    check('Lightweight Home/More omit secondary SQL; profile and support load separately and legacy clients remain compatible');
    for (let id = 2; id <= 25; id++) {
      await seed(schema.tests, {
        id,
        institutionId: 1,
        classId: 1,
        sectionId: 1,
        subjectId: 1,
        staffId: 7,
        createdByRole: 'STAFF',
        type: id === 25 ? 'FINAL' : 'QUIZ',
        title: 'Assessment ' + id,
        maxMarks: 10,
        date: '2026-10-10',
        resultsPublishedAt: new Date(),
      });
      await seed(schema.marks, {
        testId: id,
        institutionId: 1,
        studentId: 1,
        marksObtained: id === 25 ? 10 : 6,
        totalMarks: 10,
      });
    }
    const results = async (query = '') =>
      portal.GET(
        new NextRequest(
          'http://localhost/api/parent/portal?section=results&student=1&period=MONTHLY&anchor=2026-10-10' +
            query,
        ),
      );
    let data = await (await results()).json();
    assert.equal(data.results.length, 20);
    assert.equal(data.pagination.total, 25);
    assert.equal(data.performance[0].highest, 70);
    data = await (await results('&page=2')).json();
    assert.equal(data.results.length, 5);
    data = await (await results('&type=FINAL')).json();
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].type, 'FINAL');
    assert.equal((await results('&type=INVALID')).status, 400);
    assert.equal(
      (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=results&student=2')))
        .status,
      404,
    );
    check('Parent result pagination, type filter, best-score scope and unlinked-child rejection');

    state.session = { role: 'STAFF', userId: 7, institutionId: 1 };
    for (let id = 1; id <= 51; id++)
      await seed(schema.assignments, {
        id,
        institutionId: 1,
        classId: 1,
        sectionId: 1,
        subjectId: 1,
        staffId: 7,
        title: 'Assignment ' + id,
        dueAt: new Date('2026-10-20'),
        createdAt: new Date('2026-10-01'),
      });
    const assignmentRoute = await load('src/app/api/staff/assignments/route.ts');
    const assignmentGet = async (cursor = '') =>
      assignmentRoute.GET(
        new NextRequest(
          'http://localhost/api/staff/assignments?sectionId=1&limit=50' +
            (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
        ),
        {},
      );
    data = await (await assignmentGet()).json();
    assert.equal(data.assignments.length, 50);
    assert.equal(typeof data.page.nextCursor, 'string');
    assert.equal(data.nextCursor, undefined);
    data = await (await assignmentGet(data.page.nextCursor)).json();
    assert.equal(data.assignments.length, 1);
    assert.equal(data.page.nextCursor, null);
    check('Teacher assignments use the real nested page.nextCursor contract beyond 50 records');
    state.session = { role: 'PARENT', userId: 1, institutionId: 1 };
    const fees = await load('src/app/api/student/fees/route.ts');
    for (let id = 1; id <= 22; id++)
      await seed(schema.feeInvoices, {
        id,
        institutionId: 1,
        studentId: 1,
        status: 'DUE',
        totalAmount: 1000,
        paidAmount: 0,
        billingMonth: '2026-10',
        dueDate: '2026-10-31',
      });
    for (let id = 1; id <= 51; id++)
      await seed(schema.feeInvoiceItems, {
        id,
        invoiceId: 1,
        label: 'Charge ' + id,
        type: 'CHARGE',
        amount: 10,
      });
    const feeGet = async (query = '') =>
      fees.GET(new NextRequest('http://localhost/api/student/fees?studentId=1' + query), {});
    data = await (await feeGet()).json();
    assert.equal(data.invoices.length, 20);
    assert.equal(data.summary.balance, 22000);
    assert.equal(data.paymentAccounts[0].id, 'bank1');
    assert.equal((await (await feeGet('&activePage=2')).json()).invoices.length, 2);
    data = await (await feeGet('&invoiceId=1')).json();
    assert.equal(data.items.length, 50);
    assert.equal(data.hasMore, true);
    assert.equal((await (await feeGet('&invoiceId=1&page=2')).json()).items.length, 1);
    const proof = {
      action: 'complete',
      invoiceId: 1,
      amount: 300,
      paymentAccountId: 'bank1',
      sourceBankName: 'Test Bank',
      transactionId: 'REF-123',
      publicId: 'student-fees/1/1/1/proof',
      resourceType: 'image',
      format: 'png',
    };
    const pay = async (body: any, child = 1) =>
      fees.POST(
        new NextRequest('http://localhost/api/student/fees?studentId=' + child, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        {},
      );
    assert.equal((await pay({ action: 'signature', invoiceId: 999999 })).status, 409);
    const uploadTarget = await pay({ action: 'signature', invoiceId: 1 });
    assert.equal(uploadTarget.status, 200);
    const uploadFields = await uploadTarget.json();
    assert.equal(uploadFields.uploadUrl, '/api/student/fees?studentId=1&invoiceId=1');
    assert.equal(uploadFields.signature, undefined);
    const foreignFile = new FormData(); foreignFile.set('file', new File(['synthetic'], 'proof.png'));
    assert.equal((await fees.POST(new NextRequest('http://localhost/api/student/fees?studentId=1&invoiceId=999999', { method: 'POST', body: foreignFile }), {})).status, 409);
    assert.equal((await pay({ ...proof, amount: 1001 })).status, 409);
    assert.equal((await pay({ ...proof, paymentAccountId: 'removed' })).status, 409);
    assert.equal((await pay(proof, 2)).status, 403);
    response = await pay(proof);
    assert.equal(response.status, 201, JSON.stringify(await response.json()));
    const [savedProof] = await db.select().from(schema.feePaymentSubmissions);
    assert.equal(savedProof.submittedByRole, 'PARENT');
    assert.equal(savedProof.amount, 300);
    assert.equal((savedProof.paymentAccount as any).id, 'bank1');
    for (let id = 23; id <= 30; id++) await seed(schema.feeInvoices, {
      id, institutionId: 1, studentId: 1, status: 'DUE', totalAmount: 1000, paidAmount: 0,
      billingMonth: '2026-10', dueDate: '2026-10-31',
    });
    const aggregateHome = await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=home&view=overview&student=1'))).json();
    assert.equal(aggregateHome.summary.outstandingFees, 30000, 'Overview totals aggregate all invoices without loading or truncating a list');
    check(
      'Parent fee global totals, invoice and detail pagination, selected account, partial payment and unauthorized child/overpayment rejection',
    );
    state.session = { role: 'STAFF', userId: 7, institutionId: 1 };
    await seed(schema.onlineTests, { id: 10, institutionId: 1, testId: 1, mode: 'MIX', durationMinutes: 20 });
    await seed(schema.onlineTestQuestions, {
      id: 100,
      onlineTestId: 10,
      questionType: 'SHORT',
      prompt: 'Explain fractions',
      marks: 5,
      orderIndex: 0,
    });
    await seed(schema.onlineTestSubmissions, {
      id: 1000,
      institutionId: 1,
      onlineTestId: 10,
      studentId: 1,
      status: 'PENDING_REVIEW',
      answers: { '100': 'Part of a whole' },
      mcqScore: 3,
      totalScore: 3,
    });
    const detailsRoute = await load('src/app/api/staff/host-tests/[id]/details/route.ts'),
      answersRoute = await load('src/app/api/staff/host-tests/[id]/submissions/[submissionId]/route.ts'),
      gradeRoute = await load('src/app/api/staff/host-tests/[id]/grade/route.ts');
    const context = { params: Promise.resolve({ id: '10', submissionId: '1000' }) };
    data = await (
      await detailsRoute.GET(new NextRequest('http://localhost/api/staff/host-tests/10/details'), context)
    ).json();
    assert.equal(data.submissions[0].id, 1000);
    assert.equal(data.questions[0].prompt, 'Explain fractions');
    data = await (
      await answersRoute.GET(
        new NextRequest('http://localhost/api/staff/host-tests/10/submissions/1000'),
        context,
      )
    ).json();
    assert.equal(data.answers['100'], 'Part of a whole');
    const grade = async (score: number) =>
      gradeRoute.POST(
        new NextRequest('http://localhost/api/staff/host-tests/1000/grade', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ shortScores: { '100': score } }),
        }),
        { params: Promise.resolve({ id: '1000' }) },
      );
    assert.equal((await grade(6)).status, 400);
    assert.equal((await grade(4)).status, 200);
    assert.equal((await db.select().from(schema.onlineTestSubmissions))[0].totalScore, 7);
    state.session = { role: 'STAFF', userId: 8, institutionId: 1 };
    assert.equal(
      (
        await answersRoute.GET(
          new NextRequest('http://localhost/api/staff/host-tests/10/submissions/1000'),
          context,
        )
      ).status,
      404,
    );
    check('Hosted-test details, answers, score bounds, grading persistence and teacher ownership');
    state.session = { role: 'STUDENT', userId: 1, institutionId: 1, studentAcademicStatus: 'GRADUATED' };
    await seed(schema.batchExams, {
      id: 1,
      institutionId: 1,
      title: 'Annual Exam',
      type: 'PROMOTION',
      officialPublishedAt: new Date(),
    });
    await seed(schema.batchExamSubjects, {
      id: 1,
      batchExamId: 1,
      subjectId: 1,
      maxMarks: 100,
      isPublished: true,
      reviewDeadline: new Date('2026-01-01'),
    });
    await seed(schema.batchExamResults, { id: 1, batchExamSubjectId: 1, studentId: 1, marksObtained: 90 });
    const transcriptRoute = await load('src/app/api/student/transcripts/[id]/route.ts');
    data = await (
      await transcriptRoute.GET(new NextRequest('http://localhost/api/student/transcripts/1'), {
        params: Promise.resolve({ id: '1' }),
      })
    ).json();
    assert.equal(data.identity.student.name, 'Student 1');
    assert.equal(data.identity.institution.name, 'Fixture School');
    assert.equal(data.results[0].marksObtained, 90);
    check('Graduate transcript includes document identity without requiring restricted ID-card endpoint');

    const institutionSession = { role: 'INSTITUTION', userId: 1, institutionId: 1 };
    state.session = institutionSession;
    await seed(schema.subjects, { id: 2, institutionId: 1, name: 'Science' });
    await seed(schema.gradingScales, { institutionId: 1, passingPercentage: 40, gradesJson: [
      {letter:'A',min:80,max:100},{letter:'B',min:40,max:79},{letter:'F',min:0,max:39},
    ] });
    await memory.exec("SELECT setval(pg_get_serial_sequence('batch_exams','id'),(SELECT max(id) FROM batch_exams)); SELECT setval(pg_get_serial_sequence('batch_exam_subjects','id'),(SELECT max(id) FROM batch_exam_subjects)); SELECT setval(pg_get_serial_sequence('batch_exam_results','id'),(SELECT max(id) FROM batch_exam_results))");
    const examsApi = await load('src/app/api/institution/batch-exams/route.ts');
    const teacherApi = await load('src/app/api/staff/batch-results/[id]/route.ts');
    const batchService = await load('src/lib/batch-exams.ts') as typeof import('../src/lib/batch-exams');
    const promotionApi = await load('src/app/api/institution/students/auto-promote/route.ts');
    const callExam = (method: string, body?: unknown, query = '') => examsApi[method](new NextRequest('http://localhost/api/institution/batch-exams' + query, {
      method, ...(body === undefined ? {} : { headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }),
    }), {});
    const config = { title:'Reviewed annual',type:'PROMOTION',classId:1,sectionId:1,reviewHours:24,subjects:[
      {subjectId:1,maxMarks:100},
      {subjectId:2,maxMarks:100,policy:{passingPercentage:40,components:[{name:'Theory',maxMarks:80},{name:'Practical',maxMarks:20}]}},
    ] };
    assert.equal((await callExam('POST',{...config,classId:999})).status,400);
    assert.equal((await callExam('POST',{...config,studentMarks:[{rollNumber:'login1',marks:{1:'12bad'}}]})).status,400);
    assert.equal((await callExam('POST',null)).status,400);
    let created = await callExam('POST',config);
    assert.equal(created.status,201);
    const examId = (await created.json()).id;
    let report = await batchService.getBatchExamReport(1,examId);
    assert.equal(report.students.length,2);
    assert.equal(report.subjects[0].completed,0);
    assert.equal(report.students[0].results[0].status,'NOT_ENTERED');
    const math = report.subjects.find((subject)=>subject.name==='Math')!;
    const science = report.subjects.find((subject)=>subject.name==='Science')!;
    const teacherContext = {params:Promise.resolve({id:String(math.id)})};
    const teacherRequest = (method:string,body?:unknown) => new NextRequest('http://localhost/api/staff/batch-results/'+math.id,{
      method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
    });
    const markChanges = (rows:BatchExamReport['students'], subjectId:number, value:unknown) => rows.map(student => {
      const result=student.results.find((row)=>row.subjectId===subjectId);
      return {resultId:result!.id,revision:result!.revision,value};
    });
    state.session={role:'STAFF',userId:7,institutionId:1};
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:markChanges(report.students,math.id,80)}),teacherContext)).status,400);
    state.session=institutionSession;
    assert.equal((await callExam('PATCH',{id:examId,action:'PUBLISH'})).status,400);
    assert.equal((await callExam('PATCH',{id:examId,action:'REVIEW',reviewHours:2})).status,200);
    state.session={role:'STAFF',userId:7,institutionId:1};
    const teacherView=await (await teacherApi.GET(teacherRequest('GET'),teacherContext)).json();
    assert.equal(teacherView.subjects.length,1);
    assert.equal(teacherView.students[0].results.length,1);
    assert.equal(teacherView.subject.canEdit,true);
    const initial=markChanges(report.students,math.id,0);
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:initial}),teacherContext)).status,200);
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:initial}),teacherContext)).status,409);
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal(report.students[0].results.find((row)=>row.subjectId===math.id)!.status,'MARKED');
    assert.equal(report.students[0].results.find((row)=>row.subjectId===math.id)!.marks,0);
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:markChanges(report.students,math.id,101)}),teacherContext)).status,400);
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:markChanges(report.students,science.id,20)}),teacherContext)).status,400);
    state.session={role:'STAFF',userId:8,institutionId:1};
    assert.equal((await teacherApi.GET(teacherRequest('GET'),teacherContext)).status,404);
    state.session=institutionSession;
    const save = async (subjectId:number, values:unknown[]) => {
      const current=await batchService.getBatchExamReport(1,examId);
      return callExam('PATCH',{id:examId,action:'SAVE',changes:current.students.map((student,index:number)=>markChanges([student],subjectId,values[index])[0])});
    };
    assert.equal((await save(math.id,['ABSENT',80])).status,200);
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal(report.students[0].results.find((row)=>row.subjectId===math.id)!.status,'ABSENT');
    await db.update(schema.batchExamSubjects).set({reviewDeadline:new Date(Date.now()-3600_000)}).where(eq(schema.batchExamSubjects.batchExamId,examId));
    assert.equal((await batchService.getStudentBatchReports(1,1)).some((row)=>row.id===examId),false);
    state.session={role:'PARENT',userId:1,institutionId:1};
    const parentDraft=await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=results&student=1&notificationBatchExamId='+examId));
    assert.deepEqual((await parentDraft.json()).results,[]);
    state.session={role:'STAFF',userId:7,institutionId:1};
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:markChanges(report.students,math.id,80)}),teacherContext)).status,400);
    state.session=institutionSession;
    await callExam('PATCH',{id:examId,action:'REVIEW'});
    await save(math.id,[80,80]);
    await save(science.id,[{status:'EXEMPT'},{status:'MARKED',marks:20,components:{Theory:15,Practical:5}}]);
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal(report.students[0].totalMax,100);
    assert.equal(report.students[0].result,'PASS');
    assert.equal(report.students[1].percentage,50);
    assert.equal(report.students[1].result,'FAIL'); // Overall passes, Science fails.
    state.session={role:'STAFF',userId:7,institutionId:1};
    assert.equal((await teacherApi.POST(teacherRequest('POST'),teacherContext)).status,200);
    state.session=institutionSession;
    await callExam('PATCH',{id:examId,action:'REVIEW_SUBJECT',subjectId:science.id});
    assert.equal((await callExam('PATCH',{id:examId,action:'PUBLISH'})).status,200);
    assert.equal((await callExam('PATCH',{id:examId,action:'PUBLISH'})).status,200);
    assert.equal((await batchService.getStudentBatchReports(1,1,examId)).length,1);
    state.session={role:'PARENT',userId:1,institutionId:1};
    const parentPublished=await (await portal.GET(new NextRequest('http://localhost/api/parent/portal?section=results&student=1&notificationBatchExamId='+examId))).json();
    assert.ok(parentPublished.results.some((row:{status:string})=>row.status==='EXEMPT'));
    state.session=institutionSession;
    check('Exam drafts, zero versus absence/exemption, review deadlines, teacher scope, stale revisions and explicit publication');
    report=await batchService.getBatchExamReport(1,examId);
    let correction=markChanges([report.students[0]],math.id,90);
    assert.equal((await callExam('PATCH',{id:examId,action:'SAVE',changes:correction})).status,400);
    state.session={role:'STAFF',userId:7,institutionId:1};
    assert.equal((await teacherApi.PATCH(teacherRequest('PATCH',{changes:correction}),teacherContext)).status,400);
    state.session=institutionSession;
    assert.equal((await callExam('PATCH',{id:examId,action:'SAVE',changes:correction,reason:'Verified original answer sheet'})).status,200);
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal(report.version,2);
    const historical=await batchService.getBatchExamReport(1,examId,db as unknown as Parameters<typeof batchService.getBatchExamReport>[2],1);
    assert.equal(historical.students[0].results.find((row)=>row.subjectId===math.id)!.marks,80);
    assert.equal(report.students[0].results.find((row)=>row.subjectId===math.id)!.marks,90);
    const publicReport=(await batchService.getStudentBatchReports(1,1,examId))[0];
    assert.deepEqual(publicReport.student.results[0].history,[]);
    // Concurrent editors cannot silently overwrite one another.
    correction=markChanges([report.students[0]],math.id,90);
    const races=await Promise.all([
      callExam('PATCH',{id:examId,action:'SAVE',changes:correction,reason:'Concurrent verified answer sheet one'}),
      callExam('PATCH',{id:examId,action:'SAVE',changes:correction,reason:'Concurrent verified answer sheet two'}),
    ]);
    assert.deepEqual(races.map(row=>row.status).sort(),[200,409]);
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal(report.version,3);
    // Withheld results stay private to this child, while other published students stay visible.
    const hiddenChange=markChanges([report.students[1]],science.id,{status:'WITHHELD'});
    await callExam('PATCH',{id:examId,action:'SAVE',changes:hiddenChange,reason:'Awaiting an examination investigation'});
    assert.equal((await batchService.getStudentBatchReports(1,2,examId)).length,0);
    assert.equal((await batchService.getStudentBatchReports(1,1,examId)).length,1);
    report=await batchService.getBatchExamReport(1,examId);
    await callExam('PATCH',{id:examId,action:'SAVE',changes:markChanges([report.students[1]],science.id,{marks:20,status:'MARKED',components:{Theory:15,Practical:5}}),reason:'Investigation completed and marks confirmed'});
    check('Published corrections require reasons, preserve prior report versions, hide audit data and prevent lost updates/withheld disclosure');
    created=await callExam('POST',{title:'Weighted term',type:'MID',classId:1,sectionId:1,subjects:[{subjectId:1,maxMarks:100}],
      termWeights:[{examId,weight:50}],ownWeight:50,studentMarks:[{rollNumber:'login1',marks:{1:70}},{rollNumber:'login2',marks:{1:70}}]});
    assert.equal(created.status,201);
    const weightedId=(await created.json()).id;
    const weightedDraft=await batchService.getBatchExamReport(1,weightedId);
    await callExam('PATCH',{id:weightedId,action:'REVIEW_SUBJECT',subjectId:weightedDraft.subjects[0].id});
    assert.equal((await callExam('PATCH',{id:weightedId,action:'PUBLISH'})).status,200);
    const weighted=await batchService.getBatchExamReport(1,weightedId);
    assert.equal(weighted.students[0].overallPercentage,80); // 90 from source + 70 from this term.
    const comparison=await (await callExam('GET',undefined,'?id='+weightedId+'&compare='+examId)).json();
    assert.equal(comparison.comparison.students[0].previous,90);
    assert.equal(comparison.comparison.students[0].current,80);
    assert.equal(comparison.comparison.students[0].change,-10);
    report=await batchService.getBatchExamReport(1,examId);
    await callExam('PATCH',{id:examId,action:'SAVE',changes:markChanges([report.students[0]],math.id,50),reason:'Moderation adjustment after answer review'});
    assert.equal((await batchService.getBatchExamReport(1,weightedId)).students[0].overallPercentage,80);
    created=await callExam('POST',{title:'Supplementary',type:'FINAL',classId:1,sectionId:1,subjects:[{subjectId:1,maxMarks:100}],supplementaryOf:examId});
    assert.equal(created.status,201);
    const supplementary=await batchService.getBatchExamReport(1,(await created.json()).id);
    assert.deepEqual(supplementary.students.map((student)=>student.id),[2]);
    check('Weighted term results freeze source versions; supplementary drafts contain eligible failed students only');
    await seed(schema.classes,{id:2,institutionId:1,name:'Class 2',level:2});
    await db.update(schema.classes).set({level:1}).where(eq(schema.classes.id,1));
    await seed(schema.sections,{id:2,institutionId:1,classId:2,name:'A'});
    await seed(schema.students,{id:100,institutionId:1,classId:2,sectionId:2,name:'Inactive destination student',classRollNumber:'1',loginRollNumber:'login100',isActive:false});
    await seed(schema.students,{id:101,institutionId:1,classId:1,sectionId:1,name:'Later admission',classRollNumber:'3',loginRollNumber:'login101',isActive:true});
    const promote=(body:unknown)=>promotionApi.POST(new NextRequest('http://localhost/api/institution/students/auto-promote',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    }),{});
    report=await batchService.getBatchExamReport(1,examId);
    assert.equal((await promote({batchExamId:examId})).status,400);
    assert.equal((await promote({batchExamId:examId,version:1,confirm:true})).status,409);
    const promoted=await promote({batchExamId:examId,version:report.version,confirm:true});
    assert.equal(promoted.status,200);
    assert.equal((await promoted.json()).result.promotedCount,1);
    assert.equal((await promote({batchExamId:examId,version:report.version,confirm:true})).status,409);
    const [moved]=await db.select().from(schema.students).where(eq(schema.students.id,1));
    const [retainedStudent]=await db.select().from(schema.students).where(eq(schema.students.id,2));
    assert.equal(moved.classId,2);
    assert.equal(moved.classRollNumber,'2');
    assert.equal(retainedStudent.classId,1);
    assert.equal((await db.select().from(schema.students).where(eq(schema.students.id,101)))[0].classId,1);
    const afterPromotion=await batchService.getBatchExamReport(1,examId);
    assert.equal(afterPromotion.students[0].className,'Class 1');
    assert.equal(afterPromotion.students[0].roll,'1');
    assert.equal((await callExam('PATCH',{id:examId,action:'SAVE',changes:markChanges([afterPromotion.students[0]],math.id,60),reason:'Late moderation should remain locked'})).status,400);
    assert.equal((await db.select().from(schema.studentPromotions)).length,2);
    check('Promotion requires explicit current-version approval, moves only passing exam participants and is atomic/idempotent');
    for(const invalid of [-1,101,NaN,Infinity,true,'12bad',{status:'MARKED',marks:''}]) assert.throws(()=>batchService.normalizeBatchMark(invalid,100));
    assert.throws(()=>batchService.normalizeBatchMark({marks:50,components:{Theory:40,Practical:11}},100,{components:[{name:'Theory',maxMarks:80},{name:'Practical',maxMarks:20}]}));
    assert.equal(batchService.normalizeBatchMark('',100).status,'NOT_ENTERED');
    assert.equal(batchService.normalizeBatchMark('AB',100).status,'ABSENT');
    assert.equal(batchService.normalizeBatchMark(0,100).marks,0);
    assert.equal(batchService.parseScale({passingPercentage:40,gradesJson:[null]}),null);
    assert.equal(batchService.parseScale({passingPercentage:40,gradesJson:[{letter:'A',min:50,max:100},{letter:'F',min:0,max:50}]}),null);
    assert.equal(batchService.parseScale({passingPercentage:40,gradesJson:[{letter:'A',min:60,max:100},{letter:'F',min:0,max:40}]}),null);
    assert.ok(batchService.parseScale({passingPercentage:40,gradesJson:[{letter:'A',min:40,max:100},{letter:'F',min:0,max:39}]}));
    const reportView=await load('src/components/institution/BatchResultReport.tsx');
    const document=renderToStaticMarkup(createElement(reportView.BatchResultReport,{
      student:afterPromotion.students[0],title:afterPromotion.exam.title,institution:{name:'Fixture School',logoKey:null,signatureKey:null},
      version:afterPromotion.version,published:true,grading:afterPromotion.grading,
    }));
    assert.match(document,/EXEMPT/);
    assert.match(document,/Class 1/);
    assert.match(document,/Institution grading scale/);
    assert.match(document,/Official academic report/);
    check('Branded report output uses result statuses, configured grade bands and the frozen pre-promotion class');
    check('Strict numeric and component validation rejects malformed, nonfinite and out-of-range marks');

    const migrationDb=await PGlite.create();
    try {
      await migrationDb.exec(`CREATE TABLE batch_exams(id integer PRIMARY KEY,institution_id integer,type text,official_published_at timestamp,created_at timestamp DEFAULT now());
        CREATE TABLE batch_exam_subjects(id integer PRIMARY KEY,batch_exam_id integer,is_published boolean,review_deadline timestamp,published_at timestamp);
        CREATE TABLE batch_exam_results(id integer PRIMARY KEY,marks_obtained real);
        CREATE TABLE grading_scales(institution_id integer,passing_percentage real,grades_json jsonb);
        INSERT INTO batch_exams(id,institution_id,type,official_published_at) VALUES(1,1,'FINAL',NULL),(2,1,'FINAL',NULL),(3,1,'PROMOTION',now()),(4,1,'PROMOTION',NULL);
        INSERT INTO batch_exam_subjects VALUES(1,1,false,now()-interval '1 day',NULL),(2,2,false,now()+interval '1 day',NULL),(3,3,true,now(),now()),(4,4,true,now()-interval '1 day',now());
        INSERT INTO batch_exam_results VALUES(1,0),(2,73.5);`);
      await migrationDb.exec(readFileSync('drizzle/0001_exam_result_workflow.sql','utf8'));
      const upgraded=(await migrationDb.query<{official_published_at:Date|null;settings:schema.BatchExamSettings}>('SELECT * FROM batch_exams ORDER BY id')).rows;
      assert.ok(upgraded[0].official_published_at);
      assert.deepEqual(upgraded[0].settings.gradingSnapshot,{passingPercentage:40,grades:[]});
      assert.equal((await migrationDb.query<{historical:boolean}>("SELECT official_published_at < now()-interval '23 hours' AS historical FROM batch_exams WHERE id=1")).rows[0].historical,true);
      assert.equal(upgraded[1].official_published_at,null);
      assert.ok(upgraded[2].settings.promotionAppliedAt);
      assert.equal(upgraded[3].official_published_at,null);
      assert.deepEqual((await migrationDb.query<{marks_obtained:number;details:Record<string,never>}>('SELECT marks_obtained,details FROM batch_exam_results ORDER BY id')).rows,[{marks_obtained:0,details:{}},{marks_obtained:73.5,details:{}}]);
      check('Additive migration preserves historical visibility and zero/fractional marks, keeps pending exams private and prevents repeated legacy promotions');
    } finally { await migrationDb.close(); }

    const freshDb = await PGlite.create({extensions:{pg_trgm}});
    try {
      await freshDb.exec(readFileSync('drizzle/0000_baseline.sql','utf8'));
      await freshDb.exec("SET search_path TO public");
      const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
      for(const entry of journal.entries.slice(1))await freshDb.exec(readFileSync('drizzle/'+entry.tag+'.sql','utf8'));
      assert.equal((await freshDb.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('support_record','response_policy','coverage','plan','response','record') AND table_name IN ('students','announcements','staff_assignments','fee_invoices','announcement_reads','academic_sessions')")).rows.length,6);
      const columns = await freshDb.query<{table_name:string;column_name:string}>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name,column_name) IN (('batch_exams','settings'),('batch_exam_subjects','policy'),('batch_exam_results','details'))");
      assert.equal(columns.rows.length,3);
      check('Full immutable baseline plus the additive exam migration installs successfully on a fresh isolated PostgreSQL database');
    } finally { await freshDb.close(); }


    // Institution operations use separate tenant data and real PostgreSQL queries.
    const operationsSession={role:'INSTITUTION',userId:90,institutionId:90};
    await seed(schema.institutions,{id:90,name:'Operations School',username:'operations'});
    await seed(schema.classes,{id:90,institutionId:90,name:'Operations Class'});
    await seed(schema.sections,{id:90,institutionId:90,classId:90,name:'A'});
    await seed(schema.subjects,{id:90,institutionId:90,name:'Math'});
    for(const id of [901,902])await seed(schema.students,{id,institutionId:90,classId:90,sectionId:90,name:id===901?'=HiddenFormula':'Sibling',classRollNumber:String(id),loginRollNumber:'ops'+id,isActive:true,academicStatus:'ACTIVE',createdAt:new Date('2020-01-01')});
    for(const id of [907,908,909])await seed(schema.staff,{id,institutionId:90,name:'Teacher '+id,isActive:true,deletedAt:null});
    await seed(schema.parentAccounts,{id:90,institutionId:90,email:'ops@example.test',status:'ACTIVE'});
    for(const id of [901,902])await seed(schema.parentStudents,{id,institutionId:90,parentId:90,studentId:id});
    const periods=await load('src/lib/parent-period.ts'),today=periods.pakistanDateKey();
    const addDays=(day:string,count:number)=>new Date(new Date(day+'T12:00:00Z').getTime()+count*86400000).toISOString().slice(0,10);
    const feeSupport=await load('src/lib/fee-billing.ts'),schedules=await load('src/lib/fee-installments.ts');
    await seed(schema.feeInvoices,{id:901,institutionId:90,studentId:901,billingMonth:today.slice(0,7),dueDate:addDays(today,-10),totalAmount:1000,paidAmount:200,status:'PARTIAL'});
    const installmentInput={action:'setInstallments',invoiceId:901,expectedPaidAmount:200,revision:0,reason:'Family payment schedule',installments:[{dueDate:today,amount:300},{dueDate:addDays(today,30),amount:500}]};
    await assert.rejects(()=>feeSupport.manageFeeSupport(operationsSession,{...installmentInput,installments:[{dueDate:today,amount:100},{dueDate:addDays(today,30),amount:500}]}),/balance exactly/);
    await assert.rejects(()=>feeSupport.manageFeeSupport({...operationsSession,institutionId:1},installmentInput),/not found/);
    await feeSupport.manageFeeSupport(operationsSession,installmentInput);
    await assert.rejects(()=>feeSupport.manageFeeSupport(operationsSession,installmentInput),/changed/);
    let planned=(await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id,901)))[0];
    assert.equal(schedules.invoiceInstallments(planned).overdueAmount,0);
    assert.equal(schedules.invoiceInstallments(planned).nextDueDate,today);
    await db.update(schema.feeInvoices).set({paidAmount:600}).where(eq(schema.feeInvoices.id,901));
    planned=(await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id,901)))[0];
    assert.deepEqual(schedules.invoiceInstallments(planned).installments.map((row:any)=>row.remaining),[0,400]);
    await feeSupport.manageFeeSupport(operationsSession,{action:'feeFollowUp',invoiceId:901,note:'Parent contacted',nextDate:addDays(today,2)});
    const opsAccountService=await load('src/lib/student-fees.ts');
    const opsAccount=await opsAccountService.getStudentFeeAccount(90,901);
    assert.equal(opsAccount.invoices[0].installments[1].remaining,400);
    assert.equal(opsAccount.invoices[0].plan.followUps,undefined,'Collection notes stay private to the institution');
    const familyRequest={action:'siblingDiscount',studentId:901,amount:100,startMonth:today.slice(0,7)};
    const family=await feeSupport.manageFeeSupport(operationsSession,familyRequest);
    assert.equal(family.family.length,2);
    await assert.rejects(()=>feeSupport.manageFeeSupport(operationsSession,{...familyRequest,confirm:true,expectedPreviewHash:'0'.repeat(64)}),/family changed/);
    await feeSupport.manageFeeSupport(operationsSession,{...familyRequest,confirm:true,expectedPreviewHash:family.previewHash});
    await assert.rejects(()=>feeSupport.manageFeeSupport(operationsSession,{...familyRequest,confirm:true,expectedPreviewHash:family.previewHash}),/already has/);
    assert.equal((await db.select().from(schema.studentFeeAdjustments).where(eq(schema.studentFeeAdjustments.institutionId,90))).length,2);
    check('Installment totals, current payment/revision protection, FIFO allocation, tenant isolation and confirmed sibling discounts');

    const sessionsService=await load('src/lib/institution-academics-data.ts');
    await seed(schema.academicSessions,{id:90,institutionId:90,name:'Current year',startDate:'2098-01-01',endDate:'2098-12-31',isCurrent:true});
    await memory.exec('SELECT setval(pg_get_serial_sequence(\'academic_sessions\',\'id\'),1000)');
    const nextYear={name:'Next year',startDate:'2099-01-01',endDate:'2099-12-31'};
    const preview=await sessionsService.rolloverAcademicSession(operationsSession,nextYear);
    assert.equal(preview.students,2);assert.equal(preview.carryForwardBalance,400);
    await assert.rejects(()=>sessionsService.rolloverAcademicSession(operationsSession,{...nextYear,confirm:true,rolloverId:'00000000-0000-4000-8000-000000000090',expectedPreviewHash:'0'.repeat(64)},true),/preview changed/);
    const confirmation={...nextYear,confirm:true,rolloverId:'00000000-0000-4000-8000-000000000090',expectedPreviewHash:preview.previewHash};
    await sessionsService.rolloverAcademicSession(operationsSession,confirmation,true);
    assert.equal((await sessionsService.rolloverAcademicSession(operationsSession,confirmation,true)).alreadyApplied,true);
    await assert.rejects(()=>sessionsService.rolloverAcademicSession(operationsSession,{...confirmation,name:'Reused reference'},true),/already used/);
    const closed=(await db.select().from(schema.academicSessions).where(eq(schema.academicSessions.id,90)))[0];
    assert.equal(closed.isCurrent,false);assert.equal(closed.record.closingRoster?.length,2);
    assert.equal((await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.institutionId,90))).length,1);
    check('Rollover previews and archives placements, carries ledger balances once, rejects stale previews and supports safe retries');

    const noticeService=await load('src/lib/announcements.ts'),parentSession={role:'PARENT',userId:90,institutionId:90};
    await seed(schema.announcements,{id:901,institutionId:90,title:'Consent',content:'Trip consent',senderRole:'INSTITUTION',senderId:90,targetType:'CLASS',targetClassId:90,responsePolicy:{mode:'CONSENT',dueDate:addDays(today,5)}});
    await noticeService.markAnnouncementRead(parentSession,901,{studentId:901});
    const receipt=(await db.select().from(schema.announcementReads).where(eq(schema.announcementReads.announcementId,901)))[0];
    assert.deepEqual(receipt.response,{});
    await noticeService.markAnnouncementRead(parentSession,901,{studentId:901,answer:'YES'});
    await noticeService.markAnnouncementRead(parentSession,901,{studentId:902,answer:'NO'});
    await noticeService.markAnnouncementRead(parentSession,901,{studentId:901,answer:'YES'});
    await assert.rejects(()=>noticeService.markAnnouncementRead(parentSession,901,{studentId:901,answer:'NO'}),/already recorded/);
    await assert.rejects(()=>noticeService.markAnnouncementRead(parentSession,901,{studentId:1,answer:'YES'}));
    await assert.rejects(()=>noticeService.deleteInstitutionAnnouncement(operationsSession,901),/must be kept/);
    const childResponse=await noticeService.getVisibleAnnouncementById(parentSession,901,902);
    assert.equal(childResponse.response.answer,'NO');assert.equal(childResponse.response.studentId,902);
    assert.equal((await noticeService.getAnnouncementReceipts(operationsSession,901)).parents.length,2);
    check('Reading never supplies consent; parent responses are child-specific, immutable, tenant/link checked and protected from deletion');

    const timetable=await load('src/lib/timetable-coverage.ts');
    let coverDate=today;while(new Date(coverDate+'T12:00:00Z').getUTCDay()!==1)coverDate=addDays(coverDate,1);
    await memory.exec('SELECT setval(pg_get_serial_sequence(\'staff_assignments\',\'id\'),1000)');
    const period=await timetable.createTimetableAssignment(operationsSession,{sectionId:90,dayOfWeek:1,startTime:'09:00',endTime:'10:00',staffId:907,subjectId:90});
    await seed(schema.sections,{id:91,institutionId:90,classId:90,name:'B'});
    await timetable.createTimetableAssignment(operationsSession,{sectionId:91,dayOfWeek:1,startTime:'09:00',endTime:'10:00',staffId:908,subjectId:90});
    const cover={assignmentId:period.id,date:coverDate,staffId:908,revision:0,reason:'Primary teacher absent'};
    await assert.rejects(()=>timetable.saveTeachingCoverage(operationsSession,cover),/overlapping/);
    await seed(schema.leaveRequests,{id:901,institutionId:90,userRole:'STAFF',userId:909,startDate:coverDate,endDate:coverDate,status:'APPROVED'});
    await assert.rejects(()=>timetable.saveTeachingCoverage(operationsSession,{...cover,staffId:909}),/approved leave/);
    await db.delete(schema.leaveRequests).where(eq(schema.leaveRequests.id,901));
    await timetable.saveTeachingCoverage(operationsSession,{...cover,staffId:909});
    await assert.rejects(()=>timetable.saveTeachingCoverage(operationsSession,{...cover,staffId:909}),/changed/);
    await assert.rejects(()=>timetable.createTimetableAssignment(operationsSession,{sectionId:91,dayOfWeek:1,startTime:'09:30',endTime:'10:30',staffId:909,subjectId:90}),/overlaps/);
    const workload=await timetable.getStaffWorkload(90,coverDate);
    assert.equal(workload.slots.find((row:any)=>row.id===period.id).effectiveStaffId,909);
    assert.equal(workload.staff.find((row:any)=>row.id===909).coverPeriods,1);
    const dashboardQueries=await load('src/lib/dashboard-data.ts');
    const substituteDashboard=await dashboardQueries.fetchStaffDashboardData(90,909,1,new Date(coverDate+'T09:00:00Z'));
    assert.equal(substituteDashboard.timetable.length,1,'The substitute sees the dated period in their dashboard');
    await timetable.saveTeachingCoverage(operationsSession,{...cover,staffId:null,revision:1,reason:'Primary teacher returned'});
    assert.equal((await timetable.getStaffWorkload(90,coverDate)).slots.find((row:any)=>row.id===period.id).effectiveStaffId,907);
    check('Dated substitute coverage respects leave, overlap, tenant and revision checks; recurring creation respects future cover');

    state.session=operationsSession;
    const reportsRoute=await load('src/app/api/institution/reports/route.ts');
    const reportRequest=(query:string)=>reportsRoute.GET(new NextRequest('http://localhost/api/institution/reports?'+query));
    for(const dataset of ['STUDENTS','FEES','ATTENDANCE','RESULTS','SUPPORT']){
      const response=await reportRequest('dataset='+dataset);assert.equal(response.status,200,await response.clone().text());
    }
    assert.equal((await reportRequest('dataset=STUDENTS&columns=passwordHash')).status,400);
    const reportCsv=await reportRequest('dataset=STUDENTS&columns=name,loginId&format=csv');
    assert.match(reportCsv.headers.get('Cache-Control')||'',/no-store/);assert.match(await reportCsv.text(),/'=HiddenFormula/);

    for(const offset of [1,2,3])await seed(schema.attendances,{id:900+offset,institutionId:90,studentId:902,sectionId:90,date:addDays(today,-offset),status:'ABSENT'});
    for(const [id,offset,score] of [[901,40,90],[902,2,60]]){
      await seed(schema.tests,{id,institutionId:90,classId:90,sectionId:90,subjectId:90,staffId:907,createdByRole:'INSTITUTION',type:'QUIZ',title:'Support assessment '+id,maxMarks:100,date:addDays(today,-offset),resultsPublishedAt:new Date()});
      await seed(schema.marks,{id,institutionId:90,testId:id,studentId:902,marksObtained:score,totalMarks:100});
    }
    const absentSupport=await (await reportRequest('dataset=SUPPORT&risk=ABSENCES')).json();assert.equal(absentSupport.rows[0]._id,902);assert.equal(absentSupport.rows[0].absences,3);
    const fallingSupport=await (await reportRequest('dataset=SUPPORT&risk=MARKS')).json();assert.equal(fallingSupport.rows[0]._id,902);assert.equal(Number(fallingSupport.rows[0].decline),30);
    // Test support follow-up through its actual guarded route.
    await db.update(schema.feeInvoices).set({plan:{}}).where(eq(schema.feeInvoices.id,901));
    const support=await (await reportRequest('dataset=SUPPORT&risk=FEES')).json();
    assert.equal(support.rows.length,1);assert.equal(support.rows[0]._id,901);
    const studentRoute=await load('src/app/api/institution/students/[id]/route.ts');
    const followup={action:'supportFollowUp',revision:0,status:'MONITORING',assignedTo:907,nextDate:addDays(today,1),note:'Contacted parent and arranged support'};
    const patchSupport=()=>studentRoute.PATCH(new NextRequest('http://localhost/api/institution/students/901',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(followup)}),{params:Promise.resolve({id:'901'})});
    assert.equal((await patchSupport()).status,200);assert.equal((await patchSupport()).status,409);
    state.session={...operationsSession,institutionId:1};
    const foreignDirectory=await (await reportRequest('dataset=STUDENTS&q=ops901')).json();assert.equal(foreignDirectory.total,0);
    check('Every report executes, columns are whitelisted, CSV is formula-safe, tenant filters hold and support follow-ups reject stale saves');

    const auth = await load('src/lib/auth.ts', true);
    const planDeviceSessionId = '00000000-0000-4000-8000-000000000001';
    await seed(schema.planDeviceSessions, { id: planDeviceSessionId, institutionId: 1, userRole: 'STAFF', userId: 7, refreshTokenHash: 'f'.repeat(64), expiresAt: new Date(Date.now() + 86400000) });
    const actor = { role: 'STAFF', userId: 7, institutionId: 1, planDeviceSessionId };
    const token = await auth.createAccessToken(actor);
    state.headers = new Headers({ authorization: 'Bearer ' + token });
    assert.equal((await auth.getSession()).userId, 7);
    state.cookieToken = token;
    state.headers = new Headers({ authorization: 'Bearer invalid-token' });
    assert.equal(await auth.getSession(), null);
    state.headers = new Headers();
    assert.equal((await auth.getSession()).userId, 7);
    state.valid = false;
    state.headers = new Headers({ authorization: 'Bearer ' + token });
    assert.equal(await auth.getSession(), null);
    check(
      'Real signed mobile bearer accepted, invalid bearer cannot fall back to cookies, web cookie remains valid, revoked account denied',
    );
    console.log(`${checks.length} mobile backend scenario groups passed.`);
  } finally {
    await memory.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
