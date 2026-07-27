import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campuses, staff, students, classes } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { getCachedOrFetch } from '@/lib/redis';

export const GET = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const campusId = req.nextUrl.searchParams.get('campusId');

  const stats = await getCachedOrFetch(`cache:dashboard:${tenantId}:${campusId || 'all'}`, 30, async () => {
    const campusFilter = campusId ? eq(staff.campusId, Number(campusId)) : undefined;
    const studentCampusFilter = campusId ? eq(students.campusId, Number(campusId)) : undefined;
    const classCampusFilter = undefined; // classes do not have campusId

    const [campusCountResult, staffCountResult, studentCountResult, classCountResult] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(campuses).where(eq(campuses.institutionId, tenantId)),
      db.select({ count: sql`count(*)` }).from(staff).where(campusFilter ? and(eq(staff.institutionId, tenantId), campusFilter) : eq(staff.institutionId, tenantId)),
      db.select({ count: sql`count(*)` }).from(students).where(studentCampusFilter ? and(eq(students.institutionId, tenantId), studentCampusFilter) : eq(students.institutionId, tenantId)),
      db.select({ count: sql`count(*)` }).from(classes).where(eq(classes.institutionId, tenantId)),
    ]);

    return {
      campuses: Number(campusCountResult[0].count),
      staff: Number(staffCountResult[0].count),
      students: Number(studentCountResult[0].count),
      classes: Number(classCountResult[0].count),
    };
  });

  return NextResponse.json(stats);
});
