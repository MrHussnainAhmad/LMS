import { readBoundedJson } from '@/lib/http';
import { db } from '@/db';
import { batchExams, batchExamSubjects, batchExamResults, classes, sections, subjects, students, staffAssignments, type BatchExamSettings, type BatchSubjectPolicy } from '@/db/schema';
import { and, eq, inArray, desc, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getBatchExamReport, normalizeBatchMark, publishBatchExam, saveBatchExamMarks } from '@/lib/batch-exams';
import { ActionInputError } from '@/lib/action-input-error';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new ActionInputError('Invalid exam.');
    const version = req.nextUrl.searchParams.get('version');
    const report = await getBatchExamReport(institutionId, Number(id), db, version ? Number(version) : undefined);
    const compare = req.nextUrl.searchParams.get('compare');
    let comparison;
    if (compare) {
      if (!Number.isSafeInteger(Number(compare)) || Number(compare) < 1 || Number(compare) === report.exam.id) throw new ActionInputError('Select another published exam to compare.');
      const previous = await getBatchExamReport(institutionId, Number(compare));
      if (!previous.exam.officialPublishedAt || previous.exam.classId !== report.exam.classId) throw new ActionInputError('Compare a published exam for the same class.');
      const priorStudents = new Map(previous.students.map(student => [student.id, student]));
      comparison = { title: previous.exam.title, version: previous.version, students: report.students.flatMap(student => {
        const prior = priorStudents.get(student.id);
        return !prior || prior.result === 'PENDING' || student.result === 'PENDING' ? [] : [{ id: student.id, name: student.name,
          previous: prior.overallPercentage, current: student.overallPercentage, change: Math.round((student.overallPercentage - prior.overallPercentage) * 100) / 100 }];
      }) };
    }
    return NextResponse.json({ ...report, comparison }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const conditions = [eq(batchExams.institutionId, institutionId)];
  const type = req.nextUrl.searchParams.get('type');
  if (type && ['MONTHLY', 'MID', 'FINAL', 'PROMOTION'].includes(type)) conditions.push(eq(batchExams.type, type as 'FINAL'));
  const [batches, rows] = await Promise.all([
    db.select({ id: batchExams.id, title: batchExams.title, type: batchExams.type, classId: batchExams.classId,
      className: classes.name, sectionName: sections.name, createdAt: batchExams.createdAt,
      officialPublishedAt: batchExams.officialPublishedAt, settings: batchExams.settings })
      .from(batchExams).innerJoin(classes, eq(classes.id, batchExams.classId)).leftJoin(sections, eq(sections.id, batchExams.sectionId))
      .where(and(...conditions)).orderBy(desc(batchExams.createdAt)),
    db.select({ batchExamId: batchExamSubjects.batchExamId, id: batchExamSubjects.id, name: subjects.name,
      reviewed: batchExamSubjects.isPublished, deadline: batchExamSubjects.reviewDeadline, staffId: batchExamSubjects.staffId,
      expected: sql<number>`count(${batchExamResults.id})::int`,
      completed: sql<number>`count(${batchExamResults.id}) FILTER (WHERE COALESCE(${batchExamResults.details}->>'status','MARKED') <> 'NOT_ENTERED')::int` })
      .from(batchExamSubjects).innerJoin(batchExams, eq(batchExams.id, batchExamSubjects.batchExamId))
      .innerJoin(subjects, eq(subjects.id, batchExamSubjects.subjectId)).leftJoin(batchExamResults, eq(batchExamResults.batchExamSubjectId, batchExamSubjects.id))
      .where(and(...conditions)).groupBy(batchExamSubjects.batchExamId, batchExamSubjects.id, subjects.name),
  ]);
  return NextResponse.json({ batches: batches.map(batch => {
    const selected = rows.filter(row => row.batchExamId === batch.id);
    const expected = selected.reduce((sum, row) => sum + row.expected, 0);
    const completed = selected.reduce((sum, row) => sum + row.completed, 0);
    return { ...batch, subjects: selected, subjectCount: selected.length, expected, completed,
      allSubjectsPublished: selected.length > 0 && selected.every(row => row.reviewed && row.expected > 0 && row.expected === row.completed) };
  }) }, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const body = await readBoundedJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ActionInputError('Invalid exam request.');
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const type = String(body.type ?? 'FINAL');
  const classId = Number(body.classId);
  const sectionId = body.sectionId ? Number(body.sectionId) : null;
  const rawSubjects = body.subjects;
  const studentMarks = body.studentMarks ?? [];
  const reviewHours = Number(body.reviewHours ?? 24);
  if (!title || title.length > 255 || !['MONTHLY','MID','FINAL','PROMOTION'].includes(type) || !Number.isSafeInteger(classId) || classId < 1 ||
      (sectionId !== null && (!Number.isSafeInteger(sectionId) || sectionId < 1)) ||
      !Array.isArray(rawSubjects) || !rawSubjects.length || rawSubjects.length > 30 ||
      !Array.isArray(studentMarks) || studentMarks.length > 5000 || !Number.isInteger(reviewHours) || reviewHours < 1 || reviewHours > 168) {
    throw new ActionInputError('Choose a title, class, valid subjects and a review window of 1?168 hours.');
  }
  const selected = rawSubjects.map((raw: { subjectId?: unknown; maxMarks?: unknown; policy?: BatchSubjectPolicy }) => {
    const subjectId = Number(raw?.subjectId), maxMarks = Number(raw?.maxMarks);
    const policy = raw?.policy ?? {};
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new ActionInputError('Invalid subject policy.');
    if (!Number.isSafeInteger(subjectId) || subjectId < 1 || !Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 1_000_000) throw new ActionInputError('Invalid subject or maximum marks.');
    if (policy.passingPercentage !== undefined && (!Number.isFinite(policy.passingPercentage) || policy.passingPercentage < 0 || policy.passingPercentage > 100)) throw new ActionInputError('Subject passing percentages must be between 0 and 100.');
    if (policy.components !== undefined && (!Array.isArray(policy.components) || !policy.components.length || policy.components.length > 5 ||
      policy.components.some(component => !component || typeof component.name !== 'string' || !component.name.trim() || component.name !== component.name.trim() || component.name.length > 40 || !Number.isFinite(component.maxMarks) || component.maxMarks <= 0) ||
      new Set(policy.components.map(component => component.name)).size !== policy.components.length ||
      Math.abs(policy.components.reduce((sum, component) => sum + component.maxMarks, 0) - maxMarks) > 0.001)) throw new ActionInputError('Distinct component names and maximum marks must add up to the subject maximum.');
    return { subjectId, maxMarks, policy };
  });
  const subjectIds = selected.map((subject: { subjectId: number }) => subject.subjectId);
  if (new Set(subjectIds).size !== subjectIds.length) throw new ActionInputError('Select each subject only once.');
  const [[schoolClass], sectionRows, schoolSubjects, assignments] = await Promise.all([
    db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId))).limit(1),
    sectionId ? db.select().from(sections).where(and(eq(sections.id, sectionId), eq(sections.classId, classId), eq(sections.institutionId, institutionId), isNull(sections.deletedAt))).limit(1) : Promise.resolve([]),
    db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.institutionId, institutionId), inArray(subjects.id, subjectIds))),
    sectionId ? db.select({ subjectId: staffAssignments.subjectId, staffId: staffAssignments.staffId }).from(staffAssignments).where(and(eq(staffAssignments.institutionId, institutionId), eq(staffAssignments.sectionId, sectionId), inArray(staffAssignments.subjectId, subjectIds))) : Promise.resolve([]),
  ]);
  if (!schoolClass || (sectionId && !sectionRows.length) || schoolSubjects.length !== subjectIds.length) throw new ActionInputError('The selected class, section or subjects do not belong to your institution.');
  let roster = await db.select({ id: students.id, name: students.name, roll: students.classRollNumber, loginId: students.loginRollNumber, sectionName: sections.name })
    .from(students).innerJoin(sections, eq(sections.id, students.sectionId)).where(and(eq(students.institutionId, institutionId), eq(students.classId, classId),
      eq(students.isActive, true), eq(students.academicStatus, 'ACTIVE'), isNull(students.deletedAt), sectionId ? eq(students.sectionId, sectionId) : undefined));
  const settings: BatchExamSettings = { workflow: 'MANUAL', phase: 'DRAFT', reviewHours, requireSubjectPass: body.requireSubjectPass !== false, reportVersion: 1 };
  if (body.periodStart || body.periodEnd) {
    const start = String(body.periodStart ?? ''), end = String(body.periodEnd ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end || !Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(end).getTime()) || new Date(start).toISOString().slice(0, 10) !== start || new Date(end).toISOString().slice(0, 10) !== end) throw new ActionInputError('Choose a valid attendance period.');
    settings.periodStart = start; settings.periodEnd = end;
  }
  if (body.supplementaryOf) {
    const original = await getBatchExamReport(institutionId, Number(body.supplementaryOf));
    if (!original.exam.officialPublishedAt || original.exam.classId !== classId) throw new ActionInputError('A supplementary exam must reference a published exam for this class.');
    const failed = new Set(original.students.filter(student => student.result === 'FAIL').map(student => student.id));
    roster = roster.filter(student => failed.has(student.id));
    settings.supplementaryOf = original.exam.id;
  }
  if (!roster.length || roster.length > 5000) throw new ActionInputError('This selection must contain between 1 and 5,000 active students.');
  if (body.termWeights !== undefined && !Array.isArray(body.termWeights)) throw new ActionInputError('Choose valid weighted exams.');
  if (body.termWeights?.length) {
    if (!Array.isArray(body.termWeights) || body.termWeights.length > 6) throw new ActionInputError('Choose at most six earlier exams.');
    const weights = body.termWeights.map((source: { examId: unknown; weight: unknown }) => ({ examId: Number(source?.examId), weight: Number(source?.weight) }));
    const ownWeight = Number(body.ownWeight);
    if (!Number.isFinite(ownWeight) || ownWeight < 0 || ownWeight > 100 || weights.some((source: { examId: number; weight: number }) => !Number.isSafeInteger(source.examId) || source.examId < 1 || !Number.isFinite(source.weight) || source.weight <= 0 || source.weight > 100) ||
      new Set(weights.map((source: { examId: number }) => source.examId)).size !== weights.length ||
      Math.abs(weights.reduce((sum: number, source: { weight: number }) => sum + source.weight, ownWeight) - 100) > 0.001) throw new ActionInputError('This exam and its earlier-exam weights must total 100%.');
    const valid = await db.select({ id: batchExams.id }).from(batchExams).where(and(eq(batchExams.institutionId, institutionId), eq(batchExams.classId, classId), sql`${batchExams.officialPublishedAt} IS NOT NULL`, inArray(batchExams.id, weights.map((source: { examId: number }) => source.examId))));
    if (valid.length !== weights.length) throw new ActionInputError('Select published earlier exams from this class.');
    settings.termWeights = weights; settings.ownWeight = ownWeight;
  }
  settings.roster = Object.fromEntries(roster.map(student => [student.id, { name: student.name, roll: student.roll, loginId: student.loginId, className: schoolClass.name, sectionName: student.sectionName }]));
  const supplied = new Map<number, Record<string, unknown>>();
  for (const row of studentMarks) {
    if (!row || typeof row !== 'object' || !row.marks || typeof row.marks !== 'object' || Array.isArray(row.marks)) throw new ActionInputError('Invalid imported result row.');
    const identifier = String(row.rollNumber ?? '').trim().toLowerCase().replace(/^([a-z]\d{2})-/, '$1');
    const matches = roster.filter(student => (row.studentId && student.id === Number(row.studentId)) || student.loginId.toLowerCase().replace(/^([a-z]\d{2})-/, '$1') === identifier || student.roll.toLowerCase() === identifier);
    if (matches.length !== 1 || supplied.has(matches[0].id)) throw new ActionInputError('An imported ID is unknown, duplicated or ambiguous. Use Student ID or select a section.');
    supplied.set(matches[0].id, row.marks);
  }
  const result = await db.transaction(async tx => {
    const [exam] = await tx.insert(batchExams).values({ institutionId, classId, sectionId, title, type: type as 'FINAL', settings }).returning({ id: batchExams.id });
    const deadline = new Date(Date.now() + reviewHours * 3600_000);
    const createdSubjects = await tx.insert(batchExamSubjects).values(selected.map((subject: { subjectId: number; maxMarks: number; policy: BatchSubjectPolicy }) => {
      const teachers = [...new Set(assignments.filter(assignment => assignment.subjectId === subject.subjectId).map(assignment => assignment.staffId))];
      return { batchExamId: exam.id, ...subject, staffId: teachers.length === 1 ? teachers[0] : null, reviewDeadline: deadline, isPublished: false };
    })).returning();
    const results: Array<typeof batchExamResults.$inferInsert> = [];
    for (const subject of createdSubjects) for (const student of roster) {
      const mark = normalizeBatchMark(supplied.get(student.id)?.[subject.subjectId], subject.maxMarks, subject.policy);
      results.push({ batchExamSubjectId: subject.id, studentId: student.id, marksObtained: mark.marks, details: { ...mark, revision: 0 } });
    }
    for (let index = 0; index < results.length; index += 2000) await tx.insert(batchExamResults).values(results.slice(index, index + 2000));
    return exam;
  });
  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
});

export const PATCH = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const body = await readBoundedJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ActionInputError('Invalid exam request.');
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new ActionInputError('Invalid exam.');
  if (body.action === 'SAVE') return NextResponse.json(await saveBatchExamMarks(session, id, body.changes ?? [], String(body.reason ?? '')));
  if (body.action === 'PUBLISH') {
    const result = await publishBatchExam(session, id);
    const [subject] = await db.select({ id: batchExamSubjects.id }).from(batchExamSubjects).where(eq(batchExamSubjects.batchExamId, id)).limit(1);
    if (subject) await (await import('@/lib/notification-events')).notifyBatchResults(institutionId, subject.id);
    return NextResponse.json(result);
  }
  return db.transaction(async tx => {
    const [exam] = await tx.select().from(batchExams).where(and(eq(batchExams.id, id), eq(batchExams.institutionId, institutionId))).for('update').limit(1);
    if (!exam || exam.officialPublishedAt) throw new ActionInputError('This exam is unavailable or already published.');
    if (body.action === 'REVIEW') {
      const hours = Number(body.reviewHours ?? exam.settings.reviewHours ?? 24);
      if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new ActionInputError('Review must last between 1 and 168 hours.');
      await tx.update(batchExams).set({ settings: { ...exam.settings, phase: 'REVIEW', reviewHours: hours } }).where(eq(batchExams.id, id));
      await tx.update(batchExamSubjects).set({ reviewDeadline: new Date(Date.now() + hours * 3600_000) }).where(eq(batchExamSubjects.batchExamId, id));
    } else if (body.action === 'REVIEW_SUBJECT' || body.action === 'REOPEN_SUBJECT') {
      const report = await getBatchExamReport(institutionId, id, tx);
      const subject = report.subjects.find(row => row.id === Number(body.subjectId));
      if (!subject || (body.action === 'REVIEW_SUBJECT' && (subject.missing || !subject.expected))) throw new ActionInputError('Complete the selected subject before marking it reviewed.');
      await tx.update(batchExamSubjects).set({ isPublished: body.action === 'REVIEW_SUBJECT', publishedAt: body.action === 'REVIEW_SUBJECT' ? new Date() : null }).where(eq(batchExamSubjects.id, subject.id));
      if (body.action === 'REOPEN_SUBJECT') {
        await tx.update(batchExamSubjects).set({ reviewDeadline: new Date(Date.now() + (exam.settings.reviewHours ?? 24) * 3600_000) }).where(eq(batchExamSubjects.id, subject.id));
        await tx.update(batchExams).set({ settings: { ...exam.settings, phase: 'REVIEW' } }).where(eq(batchExams.id, id));
      }
    } else throw new ActionInputError('Unknown exam action.');
    return NextResponse.json({ success: true });
  });
});
