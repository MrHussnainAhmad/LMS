import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { batchExamSubjects, batchExams } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getBatchExamReport, saveBatchExamMarks } from '@/lib/batch-exams';
import { readBoundedJson } from '@/lib/http';
import { ActionInputError } from '@/lib/action-input-error';

export const GET = requireRole(['STAFF'], async (_req: NextRequest, { session, params }) => {
  const institutionId = getTenantContext(session);
  const subjectId = Number((await params).id);
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) throw new ActionInputError('Invalid subject.');
  const [subject] = await db.select({ examId: batchExamSubjects.batchExamId }).from(batchExamSubjects)
    .innerJoin(batchExams, eq(batchExams.id, batchExamSubjects.batchExamId))
    .where(and(eq(batchExamSubjects.id, subjectId), eq(batchExamSubjects.staffId, session.userId), eq(batchExams.institutionId, institutionId))).limit(1);
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  const report = await getBatchExamReport(institutionId, subject.examId);
  const selected = report.subjects.find(row => row.id === subjectId)!;
  // Never expose other teachers' subjects, correction records or student identities.
  return NextResponse.json({
    exam: { id: report.exam.id, title: report.exam.title, className: report.exam.className, settings: { phase: report.exam.settings.phase }, officialPublishedAt: report.exam.officialPublishedAt },
    subjects: [selected],
    students: report.students.map(student => ({ id: student.id, name: student.name, roll: student.roll,
      results: student.results.filter(row => row.subjectId === subjectId).map(row => ({ ...row, history: [] })) })),
    version: report.version,
    subject: { id: subjectId, subjectName: selected.name, examTitle: report.exam.title, examType: report.exam.type,
      className: report.exam.className, sectionName: report.exam.sectionName, maxMarks: selected.maxMarks, policy: selected.policy,
      isPublished: selected.reviewed, isEffectivelyPublished: selected.reviewed,
      reviewDeadline: selected.deadline, officialPublishedAt: report.exam.officialPublishedAt,
      canEdit: !report.exam.officialPublishedAt && !selected.reviewed && report.exam.settings.phase !== 'DRAFT' && selected.deadline >= new Date() },
    results: report.students.map(student => {
      const row = student.results.find(result => result.subjectId === subjectId)!;
      return { id: row.id, studentId: student.id, studentName: student.name, rollNumber: student.roll,
        marksObtained: row.marks, status: row.status, revision: row.revision, components: row.components,
        remark: row.remark, isEdited: row.revision > 0 };
    }),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const PATCH = requireRole(['STAFF'], async (req: NextRequest, { session, params }) => {
  const institutionId = getTenantContext(session);
  const subjectId = Number((await params).id);
  const [subject] = await db.select({ examId: batchExamSubjects.batchExamId }).from(batchExamSubjects)
    .innerJoin(batchExams, eq(batchExams.id, batchExamSubjects.batchExamId))
    .where(and(eq(batchExamSubjects.id, subjectId), eq(batchExamSubjects.staffId, session.userId), eq(batchExams.institutionId, institutionId))).limit(1);
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  const body = await readBoundedJson(req);
  if (!body || typeof body !== 'object') throw new ActionInputError('Provide result changes and their revisions.');
  // Older released clients edit a row once. Revision zero permits that first edit,
  // while still rejecting every stale retry after another writer has changed it.
  const changes = body.changes ?? [{ resultId: body.resultId, revision: body.revision ?? 0, value: body.value ?? body.newMarks }];
  // Ownership of every row and the deadline are checked again under the exam lock.
  return NextResponse.json(await saveBatchExamMarks(session, subject.examId, changes));
});

export const POST = requireRole(['STAFF'], async (_req: NextRequest, { session, params }) => {
  const institutionId = getTenantContext(session);
  const subjectId = Number((await params).id);
  return db.transaction(async tx => {
    const [owned] = await tx.select({ examId: batchExamSubjects.batchExamId }).from(batchExamSubjects)
      .innerJoin(batchExams, eq(batchExams.id, batchExamSubjects.batchExamId))
      .where(and(eq(batchExamSubjects.id, subjectId), eq(batchExamSubjects.staffId, session.userId), eq(batchExams.institutionId, institutionId))).limit(1);
    if (!owned) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    const [exam] = await tx.select().from(batchExams).where(eq(batchExams.id, owned.examId)).for('update').limit(1);
    const report = await getBatchExamReport(institutionId, exam.id, tx);
    const subject = report.subjects.find(row => row.id === subjectId)!;
    if (exam.officialPublishedAt || exam.settings.phase === 'DRAFT' || subject.deadline < new Date()) throw new ActionInputError('Review is closed. Ask the institution to reopen it.');
    if (subject.missing || !subject.expected) throw new ActionInputError('Enter marks or an explicit status for every student before submitting.');
    await tx.update(batchExamSubjects).set({ isPublished: true, publishedAt: new Date() }).where(eq(batchExamSubjects.id, subjectId));
    return NextResponse.json({ success: true, message: 'Review submitted for institution approval.' });
  });
});
