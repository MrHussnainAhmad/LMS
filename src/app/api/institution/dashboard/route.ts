import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campuses, staff, students, classes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';

export const GET = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);

  const [campusCount] = await db.select({ count: sql`count(*)` }).from(campuses).where(eq(campuses.institutionId, tenantId));
  const [staffCount] = await db.select({ count: sql`count(*)` }).from(staff).where(eq(staff.institutionId, tenantId));
  const [studentCount] = await db.select({ count: sql`count(*)` }).from(students).where(eq(students.institutionId, tenantId));
  const [classCount] = await db.select({ count: sql`count(*)` }).from(classes).where(eq(classes.institutionId, tenantId));

  return NextResponse.json({
    campuses: Number(campusCount.count),
    staff: Number(staffCount.count),
    students: Number(studentCount.count),
    classes: Number(classCount.count),
  });
});
