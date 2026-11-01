import { effectiveTeachingStaffId } from '@/lib/timetable-coverage';
import { pakistanDateKey } from '@/lib/parent-period';
import { z } from 'zod';
import { NextRequest } from 'next/server';
export { corsPreflight as OPTIONS } from '@/lib/cors';
import { db } from '@/db';
import { classes, staffAssignments, subjects, sections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { getCachedOrFetch } from '@/lib/redis';
import { decodeDashboardPayload, timetableResponse } from '@/lib/dashboard-response';

export const GET = requireRole(['STAFF'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const date=z.string().date().parse(req.nextUrl.searchParams.get('date')??pakistanDateKey());

  const timetable = await getCachedOrFetch(
    `cache:timetable:staff:v3:${tenantId}:${session.userId}:${date}`,
    600,
    () => db.select({
      dayOfWeek: staffAssignments.dayOfWeek,
      startTime: staffAssignments.startTime,
      endTime: staffAssignments.endTime,
      subjectName: subjects.name,
      className: classes.name,
      sectionName: sections.name,
    })
      .from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .leftJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(effectiveTeachingStaffId(date), session.userId), eq(staffAssignments.institutionId, tenantId))),
    decodeDashboardPayload,
  );

  return timetableResponse(timetable);
});
