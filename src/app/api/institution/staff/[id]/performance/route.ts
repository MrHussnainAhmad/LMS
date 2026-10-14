import { NextResponse } from 'next/server';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { getTeacherPerformance } from '@/lib/teacher-performance';
export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req, { session, params }) => {
  const id = Number((await params).id);
  const months = Number(req.nextUrl.searchParams.get('months') || 6);
  if (!Number.isSafeInteger(id) || id < 1 || ![3,6,12].includes(months)) return NextResponse.json({error:'Select a valid teacher and reporting period.'},{status:400});
  const result = await getTeacherPerformance(getTenantContext(session),id,months);
  if (!result) return NextResponse.json({error:'Teacher not found'},{status:404});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
});
