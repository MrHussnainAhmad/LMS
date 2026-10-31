import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { SQL, eq } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { NextRequest } from 'next/server';
import * as schema from '../src/db/schema';

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
    auth: 'export const getSession=async()=>globalThis.__mobileParity.session; export const getSessionFromRequest=getSession;export const getLightSessionFromRequest=getSession;export const getWarmSessionFromRequest=()=>null;',
    'next/headers':
      'export const headers=async()=>globalThis.__mobileParity.headers;export const cookies=async()=>({get:key=>key==="access_token"&&globalThis.__mobileParity.cookieToken?{value:globalThis.__mobileParity.cookieToken}:undefined});',
    'next/cache': 'export const revalidatePath=()=>{};',
    'rate-limit': 'export const withRateLimit=async()=>({success:true});export const withUploadGrantLimit=async()=>({success:true});',
    'api-policy': 'export const withApiPolicy=fn=>fn;',
    performance: 'export const measurePerformancePhase=async(_key,fn)=>fn();',
    'campus-workspaces': 'export const resolveCampusSession=async session=>session;',
    user: 'export const verifyUserExistsFresh=async()=>globalThis.__mobileParity.valid;export const getFreshStudent=async()=>globalThis.__mobileParity.valid?{academicStatus:"ACTIVE"}:null;export const getUserCreatedAt=async()=>new Date("2020-01-01");',
    redis:
      'export const invalidateStudentAttendanceCaches=async()=>{};export const invalidateStudentMarksCaches=async(...args)=>globalThis.__mobileParity.invalidated.push(args);export const invalidateInstitutionRosterCaches=async()=>{};export const invalidateAnnouncementReadCaches=async()=>{};export const getCachedOrFetch=async(key,_ttl,fn,_decode,force)=>{if(force)globalThis.__mobileParity.refreshedKeys.push(key);return fn()};',
    notifications:
      'export const createAttendanceNotifications=async()=>{};export const createBulkNotifications=async()=>{};export const processAnnouncementNotification=async id=>globalThis.__mobileParity.notified.push(id);',
    'notification-events': 'export const notifyPublishedResults=async()=>{};export const notifyTimetable=async()=>{};export const notifyAssignment=async()=>{};export const notifyBatchResults=async()=>{};export const notifyApprovedStudentLeave=async()=>{};export const notifySecurity=async()=>{};',
    'notification-delivery': 'export const createNotification=async()=>{};export const createBulkNotifications=async()=>[];',
    // Product entitlements and notification delivery have dedicated SQL suites.
    'mobile-app-access': 'export const mobileAppAccessAllowed=async()=>true;',
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
