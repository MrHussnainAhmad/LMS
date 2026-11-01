import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getStudentBatchReports } from '@/lib/batch-exams';

export const GET = requireRole(['STUDENT'], async (_req: NextRequest, { session }) => {
  const reports = await getStudentBatchReports(getTenantContext(session), session.userId);
  return NextResponse.json(reports.map(({ student, ...report }) => ({ ...report, grade: student.grade, result: student.result })),
    { headers: { 'Cache-Control': 'private, no-store' } });
});
