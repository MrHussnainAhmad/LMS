import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { readBoundedJson } from '@/lib/http';
import { saveAttendanceDelegation } from '@/lib/student-attendance';
import { invalidateStudentAttendanceCaches } from '@/lib/redis';
import { revalidatePath } from 'next/cache';

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const result = await saveAttendanceDelegation(session, await readBoundedJson(req));
  await invalidateStudentAttendanceCaches(session.institutionId!, []);
  revalidatePath('/staff/attendance');
  revalidatePath('/institution/attendance');
  return NextResponse.json(result);
});
