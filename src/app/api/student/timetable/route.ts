import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffAssignments, subjects, staff, students } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { getCachedOrFetch } from '@/lib/redis';

export const GET = requireRole(['STUDENT'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);

  const [student] = await db.select().from(students).where(eq(students.id, session.userId)).limit(1);
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const timetable = await getCachedOrFetch(
    `cache:timetable:student:${tenantId}:${student.sectionId}`,
    600,
    () => db.select({
      dayOfWeek: staffAssignments.dayOfWeek,
      startTime: staffAssignments.startTime,
      endTime: staffAssignments.endTime,
      subjectName: subjects.name,
      teacherName: staff.name,
    })
      .from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
      .where(and(eq(staffAssignments.sectionId, student.sectionId), eq(staffAssignments.institutionId, tenantId)))
  );

  return NextResponse.json({ timetable });
});
