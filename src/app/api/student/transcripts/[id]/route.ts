import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { institutions, students } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getStudentBatchReports } from '@/lib/batch-exams';
import { ActionInputError } from '@/lib/action-input-error';

export const GET = requireRole(['STUDENT'], async (_req: NextRequest, { session, params }) => {
  const institutionId = getTenantContext(session), id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) throw new ActionInputError('Invalid transcript.');
  const [report] = await getStudentBatchReports(institutionId, session.userId, id);
  if (!report) return NextResponse.json({ error: 'Transcript not found or awaiting publication' }, { status: 404 });
  const [identity] = await db.select({
    student: { name: students.name, fatherName: students.fatherName, phone: students.phone, emergencyContact: students.emergencyContact,
      profilePictureUrl: students.profilePictureUrl, loginRollNumber: students.loginRollNumber, classRollNumber: students.classRollNumber },
    institution: { name: institutions.name, logoKey: institutions.logoKey, signatureKey: institutions.signatureKey },
  }).from(students).innerJoin(institutions, eq(institutions.id, students.institutionId))
    .where(and(eq(students.id, session.userId), eq(students.institutionId, institutionId))).limit(1);
  if (!identity) return NextResponse.json({ error: 'Student record unavailable' }, { status: 404 });
  return NextResponse.json({
    identity: { ...identity, student: { ...identity.student, name: report.student.name, classRollNumber: report.student.roll,
      className: report.student.className, sectionName: report.student.sectionName } },
    examTitle: report.title, examType: report.type, examCreatedAt: report.createdAt,
    version: report.version, publishedAt: report.publishedAt, grading: report.grading,
    totalMax: report.totalMax, totalObtained: report.totalObtained, percentage: report.percentage,
    grade: report.student.grade, result: report.student.result, attendance: report.student.attendance,
    results: report.student.results.map(row => ({ subjectName: row.subjectName, maxMarks: row.maxMarks, marksObtained: row.marks,
      status: row.status, components: row.components, remark: row.remark, passed: row.passed })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
});
