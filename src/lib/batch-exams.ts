import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attendances, auditLogs, batchExamResults, batchExamSubjects, batchExams, classes, gradingScales, sections, staff, students, subjects,
  type BatchExamSettings, type BatchMarkState, type BatchResultDetails, type BatchResultStatus, type BatchSubjectPolicy } from '@/db/schema';
import type { JWTPayload } from './auth-types';
import { ActionInputError } from './action-input-error';

type Store = Pick<typeof db, 'select' | 'update' | 'insert' | 'execute'>;
export type BatchExamReport = {
  exam: typeof batchExams.$inferSelect & { className: string; sectionName: string | null };
  grading: NonNullable<BatchExamSettings['gradingSnapshot']>;
  version: number;
  students: Array<{ id: number; name: string; roll: string; loginId: string; className: string; sectionName: string;
    results: Array<BatchMarkState & { id: number; subjectId: number; subjectName: string; maxMarks: number;
      revision: number; policy: BatchSubjectPolicy; passed: boolean; percentage: number; history: NonNullable<BatchResultDetails['history']> }>;
    totalObtained: number; totalMax: number; percentage: number; overallPercentage: number; precisePercentage: number; grade: string;
    result: 'PASS' | 'FAIL' | 'PENDING'; attendance: { present: number; total: number } | null }>;
  subjects: Array<{ id: number; subjectId: number; name: string; maxMarks: number; policy: BatchSubjectPolicy;
    staffId: number | null; staffName: string | null; reviewed: boolean; deadline: Date; expected: number; completed: number; missing: number;
    overdue: boolean; average: number | null; failing: number }>;
  ready: boolean;
  statistics: { students: number; passed: number; failed: number; pending: number; average: number; highest: number };
};
export const RESULT_STATUSES: BatchResultStatus[] = ['MARKED', 'ABSENT', 'EXEMPT', 'WITHHELD', 'NOT_ENTERED'];

export function normalizeBatchMark(value: unknown, maxMarks: number, policy: BatchSubjectPolicy = {}): BatchMarkState {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { marks: value };
  const text = String(item.status ?? item.marks ?? '').trim().toUpperCase();
  const aliases: Record<string, BatchResultStatus> = { AB: 'ABSENT', EX: 'EXEMPT', WH: 'WITHHELD', '': 'NOT_ENTERED' };
  const status = item.status ? String(item.status) as BatchResultStatus : aliases[text] ?? (RESULT_STATUSES.includes(text as BatchResultStatus) ? text as BatchResultStatus : 'MARKED');
  if (!RESULT_STATUSES.includes(status)) throw new ActionInputError('Choose a valid result status.');
  const remark = String(item.remark ?? '').trim();
  if (remark.length > 500) throw new ActionInputError('Teacher remarks must be 500 characters or fewer.');
  if (status !== 'MARKED') return { status, marks: 0, remark };
  const supplied = item.marks;
  if ((typeof supplied !== 'number' && typeof supplied !== 'string') || !String(supplied).trim() || !/^\d+(\.\d{1,2})?$/.test(String(supplied))) throw new ActionInputError('Enter numeric marks or select a result status.');
  const marks = Number(supplied);
  if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks || Math.abs(marks * 100 - Math.round(marks * 100)) > 0.001) throw new ActionInputError(`Marks must be between 0 and ${maxMarks}, with at most two decimal places.`);
  const components: Record<string, number> = {};
  for (const component of policy.components ?? []) {
    const raw = (item.components as Record<string, unknown> | undefined)?.[component.name];
    const number = Number(raw);
    if ((typeof raw !== 'number' && typeof raw !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(raw)) || !Number.isFinite(number) || number < 0 || number > component.maxMarks) throw new ActionInputError(`Enter ${component.name} marks between 0 and ${component.maxMarks}, with at most two decimal places.`);
    components[component.name] = number;
  }
  if (policy.components?.length && Math.abs(Object.values(components).reduce((sum, n) => sum + n, 0) - marks) > 0.001) throw new ActionInputError('Component marks must add up to the subject total.');
  return { status, marks, remark, ...(policy.components?.length ? { components } : {}) };
}

export async function getBatchExamReport(institutionId: number, examId: number, store: Store = db, revision?: number, selectedStudentId?: number): Promise<BatchExamReport> {
  const [exam] = await store.select().from(batchExams).where(and(eq(batchExams.id, examId), eq(batchExams.institutionId, institutionId))).limit(1);
  if (!exam) throw new ActionInputError('Exam not found.');
  const [classRow] = await store.select({ name: classes.name, sectionName: sections.name }).from(classes).leftJoin(sections, eq(sections.id, exam.sectionId ?? 0)).where(and(eq(classes.id, exam.classId), eq(classes.institutionId, institutionId))).limit(1);
  const [subjectRows, rows, scales] = await Promise.all([
    store.select({ id: batchExamSubjects.id, subjectId: batchExamSubjects.subjectId, name: subjects.name, maxMarks: batchExamSubjects.maxMarks,
      policy: batchExamSubjects.policy, staffId: batchExamSubjects.staffId, staffName: staff.name, reviewed: batchExamSubjects.isPublished, deadline: batchExamSubjects.reviewDeadline })
      .from(batchExamSubjects).innerJoin(subjects, eq(subjects.id, batchExamSubjects.subjectId)).leftJoin(staff, eq(staff.id, batchExamSubjects.staffId)).where(eq(batchExamSubjects.batchExamId, exam.id)).orderBy(asc(subjects.name)),
    store.select({ id: batchExamResults.id, subjectId: batchExamResults.batchExamSubjectId, studentId: students.id, name: students.name,
      roll: students.classRollNumber, loginId: students.loginRollNumber, sectionName: sections.name,
      marks: batchExamResults.marksObtained, details: batchExamResults.details })
      .from(batchExamResults).innerJoin(batchExamSubjects, eq(batchExamSubjects.id, batchExamResults.batchExamSubjectId))
      .innerJoin(students, and(eq(students.id, batchExamResults.studentId), eq(students.institutionId, institutionId)))
      .leftJoin(sections, eq(sections.id, students.sectionId)).where(and(eq(batchExamSubjects.batchExamId, exam.id), selectedStudentId ? eq(students.id, selectedStudentId) : undefined)).orderBy(asc(students.id)),
    store.select().from(gradingScales).where(eq(gradingScales.institutionId, institutionId)).limit(1),
  ]);
  const currentVersion = exam.settings.reportVersion ?? 1;
  if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1 || revision > currentVersion)) throw new ActionInputError('Invalid report version.');
  const version = revision ?? currentVersion;
  if (!exam.officialPublishedAt && exam.settings.termWeights?.length) {
    const weightedSources: NonNullable<BatchExamSettings['weightedSources']> = [];
    for (const source of exam.settings.termWeights) {
      const previous = await getBatchExamReport(institutionId, source.examId, store, undefined, selectedStudentId);
      weightedSources.push({ examId: previous.exam.id, title: previous.exam.title, weight: source.weight, version: previous.version,
        percentages: Object.fromEntries(previous.students.filter(student => student.result !== 'PENDING').map(student => [student.id, student.precisePercentage])) });
    }
    exam.settings = { ...exam.settings, weightedSources };
  }
  const grading = exam.settings.gradingSnapshot ?? { passingPercentage: scales[0]?.passingPercentage ?? 40, grades: (scales[0]?.gradesJson ?? []) as Array<{ letter: string; min: number; max: number }> };
  const grouped = new Map<number, typeof rows>();
  for (const row of rows) { const list = grouped.get(row.studentId) ?? []; list.push(row); grouped.set(row.studentId, list); }
  for (const id of Object.keys(exam.settings.roster ?? {})) if ((!selectedStudentId || Number(id) === selectedStudentId) && !grouped.has(Number(id))) grouped.set(Number(id), []);
  const roster = [...grouped].map(([studentId, studentRows]) => {
    const identity = (exam.officialPublishedAt || !studentRows.length ? exam.settings.roster?.[studentId] : undefined) ?? { name: studentRows[0].name, roll: studentRows[0].roll, loginId: studentRows[0].loginId, className: classRow?.name ?? '', sectionName: studentRows[0].sectionName ?? '' };
    const results = subjectRows.map(subject => {
      const row = studentRows.find(result => result.subjectId === subject.id);
      const previous = row?.details.history?.find(change => change.reportVersion > version)?.before;
      const state: BatchMarkState = previous ?? { status: row?.details.status ?? (row ? 'MARKED' : 'NOT_ENTERED'), marks: row?.details.marks ?? row?.marks ?? 0, components: row?.details.components, remark: row?.details.remark };
      const percent = subject.maxMarks > 0 ? Math.round(state.marks / subject.maxMarks * 10_000) / 100 : 0;
      return { ...state, id: row?.id ?? 0, subjectId: subject.id, subjectName: subject.name, maxMarks: subject.maxMarks,
        revision: row?.details.revision ?? 0, policy: subject.policy,
        passed: state.status === 'EXEMPT' || (state.status === 'MARKED' && state.marks / subject.maxMarks * 100 >= (subject.policy.passingPercentage ?? grading.passingPercentage)), percentage: percent,
        history: row?.details.history ?? [] };
    });
    const counted = results.filter(result => result.status !== 'EXEMPT');
    const totalMax = counted.reduce((sum, result) => sum + result.maxMarks, 0);
    const totalObtained = counted.reduce((sum, result) => sum + result.marks, 0);
    const percentage = totalMax ? Math.round(totalObtained / totalMax * 10_000) / 100 : 0;
    const pending = results.some(result => result.status === 'NOT_ENTERED' || result.status === 'WITHHELD') || !totalMax;
    const preciseOwnPercentage = totalMax ? totalObtained / totalMax * 100 : 0;
    let overallPercentage = preciseOwnPercentage * (exam.settings.ownWeight ?? 100) / 100;
    let missingWeightedResult = false;
    for (const source of exam.settings.weightedSources ?? []) {
      const previous = source.percentages[studentId];
      if (previous === undefined) missingWeightedResult = true; else overallPercentage += previous * source.weight / 100;
    }
    if (!exam.settings.weightedSources?.length) overallPercentage = preciseOwnPercentage;
    const precisePercentage = overallPercentage;
    overallPercentage = Math.round(overallPercentage * 100) / 100;
    const result: 'PENDING' | 'PASS' | 'FAIL' = pending || missingWeightedResult ? 'PENDING' : precisePercentage >= grading.passingPercentage && (!exam.settings.requireSubjectPass || results.every(item => item.passed)) ? 'PASS' : 'FAIL';
    const score = grading.grades.every(range => Number.isInteger(range.min) && Number.isInteger(range.max)) ? Math.round(overallPercentage) : overallPercentage;
    const grade = result === 'PENDING' ? '—' : grading.grades.find(range => score >= range.min && score <= range.max)?.letter ?? '—';
    return { id: studentId, ...identity, results, totalObtained, totalMax, percentage, overallPercentage, precisePercentage, grade, result, attendance: exam.settings.attendance?.[studentId] ?? null };
  }).sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true }));
  const summarySubjects = subjectRows.map(subject => {
    const entries = roster.map(student => student.results.find(row => row.subjectId === subject.id)!);
    const completed = entries.filter(row => row.status !== 'NOT_ENTERED').length;
    const marked = entries.filter(row => row.status === 'MARKED');
    return { ...subject, expected: roster.length, completed, missing: roster.length - completed, overdue: !subject.reviewed && subject.deadline < new Date(),
      average: marked.length ? Math.round(marked.reduce((sum, row) => sum + row.percentage, 0) / marked.length * 100) / 100 : null,
      failing: entries.filter(row => !row.passed && row.status !== 'NOT_ENTERED' && row.status !== 'WITHHELD').length };
  });
  const passed = roster.filter(student => student.result === 'PASS').length;
  const failed = roster.filter(student => student.result === 'FAIL').length;
  const completedStudents = roster.filter(student => student.result !== 'PENDING');
  return { exam: { ...exam, className: classRow?.name ?? '', sectionName: classRow?.sectionName ?? null }, grading, version, students: roster, subjects: summarySubjects,
    ready: roster.length > 0 && summarySubjects.length > 0 && summarySubjects.every(subject => subject.missing === 0 && subject.reviewed),
    statistics: { students: roster.length, passed, failed, pending: roster.length - passed - failed,
      average: completedStudents.length ? Math.round(completedStudents.reduce((sum, student) => sum + student.precisePercentage, 0) / completedStudents.length * 100) / 100 : 0,
      highest: Math.max(0, ...completedStudents.map(student => student.overallPercentage)) } };
}

export async function saveBatchExamMarks(session: JWTPayload, examId: number, changes: Array<{ resultId: number; revision: number; value: unknown }>, reason = '') {
  if (!session.institutionId || session.campusReadOnly || session.mustChangePassword || !['INSTITUTION', 'INSTITUTION_ADMIN', 'STAFF'].includes(session.role)) throw new ActionInputError('Forbidden result edit.');
  if (!Array.isArray(changes) || !changes.length || changes.length > 500 || changes.some(change => !change || !Number.isSafeInteger(change.resultId) || change.resultId < 1) || new Set(changes.map(change => change.resultId)).size !== changes.length) throw new ActionInputError('Provide between 1 and 500 distinct result rows.');
  return db.transaction(async tx => {
    const [exam] = await tx.select().from(batchExams).where(and(eq(batchExams.id, examId), eq(batchExams.institutionId, session.institutionId!))).for('update').limit(1);
    if (!exam) throw new ActionInputError('Exam not found.');
    if (exam.settings.promotionAppliedAt) throw new ActionInputError('Promotion has been applied. This result is locked; resolve changes through a supplementary exam.');
    if (exam.officialPublishedAt && (session.role === 'STAFF' || reason.trim().length < 10)) throw new ActionInputError('Published results require an institution correction reason of at least 10 characters.');
    if (reason.length > 1000) throw new ActionInputError('The correction reason must be 1000 characters or fewer.');
    const reportVersion = (exam.settings.reportVersion ?? 1) + (exam.officialPublishedAt ? 1 : 0);
    const rows = await tx.select({ result: batchExamResults, subject: batchExamSubjects }).from(batchExamResults)
      .innerJoin(batchExamSubjects, eq(batchExamSubjects.id, batchExamResults.batchExamSubjectId))
      .where(and(eq(batchExamSubjects.batchExamId, exam.id), inArray(batchExamResults.id, changes.map(change => change.resultId))));
    if (rows.length !== changes.length) throw new ActionInputError('One or more result rows do not belong to this exam.');
    for (const change of changes) {
      const row = rows.find(item => item.result.id === change.resultId)!;
      if (session.role === 'STAFF' && (row.subject.staffId !== session.userId || row.subject.isPublished || row.subject.reviewDeadline < new Date() || exam.settings.phase === 'DRAFT')) throw new ActionInputError('This subject is not open for your review. Ask the institution to reopen it.');
      if (!Number.isSafeInteger(change.revision) || change.revision !== (row.result.details.revision ?? 0)) throw Object.assign(new ActionInputError('These marks changed in another session. Reload the sheet before saving.'), { status: 409 });
      const next = normalizeBatchMark(change.value, row.subject.maxMarks, row.subject.policy);
      const details: BatchResultDetails = { ...row.result.details, ...next, revision: change.revision + 1, updatedAt: new Date().toISOString() };
      if (exam.officialPublishedAt) details.history = [...(details.history ?? []), { before: { status: row.result.details.status ?? 'MARKED', marks: row.result.details.marks ?? row.result.marksObtained, components: row.result.details.components, remark: row.result.details.remark }, reportVersion, reason: reason.trim(), actorId: session.userId, actorRole: session.role, at: details.updatedAt! }];
      await tx.update(batchExamResults).set({ marksObtained: next.marks, details, isEdited: true }).where(eq(batchExamResults.id, row.result.id));
      if (!exam.officialPublishedAt) await tx.update(batchExamSubjects).set({ isPublished: false, publishedAt: null }).where(eq(batchExamSubjects.id, row.subject.id));
    }
    if (exam.officialPublishedAt) await tx.update(batchExams).set({ settings: { ...exam.settings, reportVersion } }).where(eq(batchExams.id, exam.id));
    await tx.insert(auditLogs).values({ institutionId: session.institutionId, actorId: session.userId, actorRole: session.role,
      action: exam.officialPublishedAt ? 'EXAM_RESULTS_CORRECTED' : 'EXAM_DRAFT_SAVED', target: `BatchExam:${exam.id}:v${reportVersion}`, ip: 'server' });
    return { saved: changes.length, reportVersion };
  });
}

export async function publishBatchExam(session: JWTPayload, examId: number) {
  if (!session.institutionId || session.campusReadOnly || session.mustChangePassword || !['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role)) throw new ActionInputError('Only your institution can release results.');
  return db.transaction(async tx => {
    const [exam] = await tx.select().from(batchExams).where(and(eq(batchExams.id, examId), eq(batchExams.institutionId, session.institutionId!))).for('update').limit(1);
    if (!exam) throw new ActionInputError('Exam not found.');
    if (exam.officialPublishedAt) return { published: true, alreadyPublished: true };
    const report = await getBatchExamReport(session.institutionId!, exam.id, tx);
    if (!report.ready) throw new ActionInputError('Complete all result rows and review every subject before publication.');
    if (!parseScale({ passingPercentage: report.grading.passingPercentage, gradesJson: report.grading.grades })) throw new ActionInputError('Configure complete, non-overlapping whole-number grade ranges covering 0–100 in Settings before publishing.');
    const settings: BatchExamSettings = { ...exam.settings, reportVersion: 1, gradingSnapshot: report.grading,
      roster: Object.fromEntries(report.students.map(student => [student.id, { name: student.name, roll: student.roll, loginId: student.loginId, className: student.className, sectionName: student.sectionName }])) };
    if (settings.termWeights?.length) {
      settings.weightedSources = [];
      for (const source of settings.termWeights) {
        const previous = await getBatchExamReport(session.institutionId!, source.examId, tx);
        if (!previous.exam.officialPublishedAt || previous.exam.id === exam.id || previous.exam.classId !== exam.classId) throw new ActionInputError('Weighted sources must be other published exams for the same class.');
        const percentages: Record<string, number> = {};
        for (const student of report.students) {
          const match = previous.students.find(row => row.id === student.id);
          if (!match || match.result === 'PENDING') throw new ActionInputError(`A weighted source is incomplete for ${student.name}.`);
          percentages[student.id] = match.precisePercentage;
        }
        settings.weightedSources.push({ examId: previous.exam.id, title: previous.exam.title, weight: source.weight, version: previous.version, percentages });
      }
    }
    if (settings.periodStart && settings.periodEnd) {
      const rows = await tx.select({ studentId: attendances.studentId, status: attendances.status, count: sql<number>`count(*)::int` }).from(attendances)
        .where(and(eq(attendances.institutionId, session.institutionId!), gte(attendances.date, settings.periodStart), lte(attendances.date, settings.periodEnd), inArray(attendances.studentId, report.students.map(student => student.id))))
        .groupBy(attendances.studentId, attendances.status);
      settings.attendance = {};
      for (const row of rows) { const current = settings.attendance[row.studentId] ?? { present: 0, total: 0 }; current.total += row.count; if (row.status === 'PRESENT' || row.status === 'LATE') current.present += row.count; settings.attendance[row.studentId] = current; }
    }
    await tx.update(batchExams).set({ officialPublishedAt: new Date(), settings }).where(eq(batchExams.id, exam.id));
    await tx.insert(auditLogs).values({ institutionId: session.institutionId, actorId: session.userId, actorRole: session.role, action: 'EXAM_RESULTS_PUBLISHED', target: `BatchExam:${exam.id}:v1`, ip: 'server' });
    return { published: true, alreadyPublished: false };
  });
}

export async function getStudentBatchReports(institutionId: number, studentId: number, examId?: number) {
  const ids = await db.selectDistinct({ id: batchExams.id }).from(batchExams).innerJoin(batchExamSubjects, eq(batchExamSubjects.batchExamId, batchExams.id))
    .innerJoin(batchExamResults, eq(batchExamResults.batchExamSubjectId, batchExamSubjects.id))
    .where(and(eq(batchExams.institutionId, institutionId), eq(batchExamResults.studentId, studentId), sql`${batchExams.officialPublishedAt} IS NOT NULL`, examId ? eq(batchExams.id, examId) : undefined)).orderBy(desc(batchExams.id));
  const reports = [];
  for (const id of ids) {
    const report = await getBatchExamReport(institutionId, id.id, db, undefined, studentId);
    const student = report.students.find(row => row.id === studentId);
    if (!student || student.results.some(row => row.status === 'WITHHELD' || row.status === 'NOT_ENTERED')) continue;
    reports.push({ id: report.exam.id, title: report.exam.title, type: report.exam.type, createdAt: report.exam.createdAt,
      publishedAt: report.exam.officialPublishedAt, version: report.version, student: { ...student, results: student.results.map(result => ({ ...result, history: [] })) }, grading: report.grading,
      totalMax: student.totalMax, totalObtained: student.totalObtained, percentage: student.overallPercentage });
  }
  return reports;
}

type Grade = { letter: string; min: number; max: number };

export function parseScale(body: unknown): { passingPercentage: number; gradesJson: Grade[] } | null {
  const value = body as { passingPercentage?: unknown; gradesJson?: unknown };
  const passingPercentage = Number(value?.passingPercentage);
  if (!Number.isFinite(passingPercentage) || passingPercentage < 0 || passingPercentage > 100 || !Array.isArray(value?.gradesJson)) return null;
  const gradesJson = value.gradesJson.map((grade): Grade | null => {
    const item = grade as { letter?: unknown; min?: unknown; max?: unknown };
    const letter = typeof item?.letter === 'string' ? item.letter.trim() : '';
    const min = Number(item?.min);
    const max = Number(item?.max);
    return letter && letter.length <= 10 && Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= 100 && min <= max
      ? { letter, min, max }
      : null;
  });
  if (!gradesJson.length || gradesJson.length > 30 || !gradesJson.every(Boolean)) return null;
  const ranges = (gradesJson as Grade[]).toSorted((a, b) => a.min - b.min);
  if (new Set(ranges.map(grade => grade.letter.toUpperCase())).size !== ranges.length || ranges[0].min !== 0 || ranges.at(-1)!.max !== 100 ||
      ranges.some((grade, index) => index > 0 && grade.min !== ranges[index - 1].max + 1)) return null;
  return { passingPercentage, gradesJson: gradesJson as Grade[] };
}

