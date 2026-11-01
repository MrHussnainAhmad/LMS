import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { batchExams, batchExamSubjects, classes, sections, subjects } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';

export const GET = requireRole(['STAFF'], async (_req: NextRequest, { session }) => {
  const rows = await db.select({
    id: batchExamSubjects.id, maxMarks: batchExamSubjects.maxMarks,
    isPublished: batchExamSubjects.isPublished, isEffectivelyPublished: batchExamSubjects.isPublished,
    reviewDeadline: batchExamSubjects.reviewDeadline, subjectName: subjects.name,
    examTitle: batchExams.title, examType: batchExams.type, className: classes.name,
    sectionName: sections.name, createdAt: batchExamSubjects.createdAt, officialPublishedAt: batchExams.officialPublishedAt,
  }).from(batchExamSubjects).innerJoin(batchExams, eq(batchExams.id, batchExamSubjects.batchExamId))
    .innerJoin(subjects, eq(subjects.id, batchExamSubjects.subjectId)).innerJoin(classes, eq(classes.id, batchExams.classId))
    .leftJoin(sections, eq(sections.id, batchExams.sectionId))
    .where(and(eq(batchExamSubjects.staffId, session.userId), eq(batchExams.institutionId, getTenantContext(session)),
      sql`COALESCE(${batchExams.settings}->>'phase','REVIEW') <> 'DRAFT'`))
    .orderBy(desc(batchExamSubjects.createdAt));
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'private, no-store' } });
});
