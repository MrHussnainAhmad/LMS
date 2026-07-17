import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campuses, staff, students, classes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { getCachedOrFetch } from '@/lib/redis';

export const GET = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);

  const stats = await getCachedOrFetch(`cache:dashboard:${tenantId}`, 30, async () => {
    const [campusCountResult, staffCountResult, studentCountResult, classCountResult] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(campuses).where(eq(campuses.institutionId, tenantId)),
      db.select({ count: sql`count(*)` }).from(staff).where(eq(staff.institutionId, tenantId)),
      db.select({ count: sql`count(*)` }).from(students).where(eq(students.institutionId, tenantId)),
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
