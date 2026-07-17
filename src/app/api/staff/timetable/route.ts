import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffAssignments, subjects, sections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { getCachedOrFetch } from '@/lib/redis';

export const GET = requireRole(['STAFF'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);

  const timetable = await getCachedOrFetch(
    `cache:timetable:staff:${tenantId}:${session.userId}`,
    600,
    () => db.select({
      dayOfWeek: staffAssignments.dayOfWeek,
      startTime: staffAssignments.startTime,
      endTime: staffAssignments.endTime,
      subjectName: subjects.name,
      sectionName: sections.name,
    })
      .from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, tenantId)))
  );

  return NextResponse.json({ timetable });
});
