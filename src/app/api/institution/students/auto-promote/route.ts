import { readBoundedJson } from '@/lib/http';
import { and, desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { batchExams, classes, sections } from '@/db/schema';
import { applyPublishedBatchPromotion } from '@/lib/batch-promotion';
import { getBatchExamReport } from '@/lib/batch-exams';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { ActionInputError } from '@/lib/action-input-error';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session), requested = req.nextUrl.searchParams.get('batchExamId');
  if (requested) {
    const id = Number(requested);
    if (!Number.isSafeInteger(id) || id < 1) throw new ActionInputError('Invalid exam.');
    const report = await getBatchExamReport(institutionId, id);
    return NextResponse.json({ report, rows: report.students.flatMap(student => student.results.map(result => ({
      studentId: student.id, student: student.name, roll: student.roll, subject: result.subjectName,
      marks: result.marks, maxMarks: result.maxMarks, status: result.status,
    }))) });
  }
  const batches = await db.select({
    id: batchExams.id, title: batchExams.title, className: classes.name, sectionName: sections.name,
    officialPublishedAt: batchExams.officialPublishedAt, settings: batchExams.settings, createdAt: batchExams.createdAt,
  }).from(batchExams).innerJoin(classes, eq(classes.id, batchExams.classId)).leftJoin(sections, eq(sections.id, batchExams.sectionId))
    .where(and(eq(batchExams.institutionId, institutionId), eq(batchExams.type, 'PROMOTION'))).orderBy(desc(batchExams.createdAt));
  return NextResponse.json({ batches: batches.map(batch => ({ ...batch, version: batch.settings.reportVersion ?? 1,
    promotionAppliedAt: batch.settings.promotionAppliedAt ?? null })) }, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const body = await readBoundedJson(req);
  if (!body || body.confirm !== true || !Number.isSafeInteger(body.batchExamId) || body.batchExamId < 1 || !Number.isSafeInteger(body.version) || body.version < 1) {
    throw new ActionInputError('Review the published report and explicitly confirm its version before applying promotion.');
  }
  const result = await applyPublishedBatchPromotion(getTenantContext(session), body.batchExamId, body.version);
  if (!result.promoted) return NextResponse.json({ error: result.reason.replaceAll('_', ' '), result }, { status: 409 });
  return NextResponse.json({ success: true, result });
});
