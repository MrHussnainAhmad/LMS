import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { staffAssignments, staff, sections, classes, subjects } from "@/db/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const url = new URL(req.url);

  if (url.searchParams.get("metadata") === "true") {
    const [allStaff, allSections, allClasses, allSubjects] = await Promise.all([
      db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.institutionId, institutionId)),
      db.select({ id: sections.id, name: sections.name, classId: sections.classId, classTeacherId: sections.classTeacherId }).from(sections).where(eq(sections.institutionId, institutionId)),
      db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.institutionId, institutionId)),
      db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.institutionId, institutionId)),
    ]);
    return NextResponse.json({ allStaff, allSections, allClasses, allSubjects });
  }

  const assignments = await db.select({
    id: staffAssignments.id,
    dayOfWeek: staffAssignments.dayOfWeek,
    startTime: staffAssignments.startTime,
    endTime: staffAssignments.endTime,
    isBreak: staffAssignments.isBreak,
    sectionId: staffAssignments.sectionId,
    staffId: staffAssignments.staffId,
    subjectId: staffAssignments.subjectId,
    teacher: staff.name,
    subject: subjects.name,
  }).from(staffAssignments)
    .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
    .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
    .where(eq(staffAssignments.institutionId, institutionId));

  return NextResponse.json({ assignments });
});

export const POST = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  
  try {
    const body = await req.json();
    
    // Support assigning Incharge
    if (body.action === "updateIncharge") {
      const { sectionId, classTeacherId, classId } = body;
      
      if (sectionId) {
        await db.update(sections)
          .set({ classTeacherId: classTeacherId || null })
          .where(and(eq(sections.id, sectionId), eq(sections.institutionId, institutionId)));
      } else if (classId) {
        const [wholeClassSection] = await db.select().from(sections)
          .where(and(eq(sections.classId, classId), eq(sections.name, "Whole Class"), eq(sections.institutionId, institutionId)))
          .limit(1);
        if (wholeClassSection) {
          await db.update(sections)
            .set({ classTeacherId: classTeacherId || null })
            .where(eq(sections.id, wholeClassSection.id));
        }
      }
      return NextResponse.json({ success: true });
    }

    const { sectionId, dayOfWeek, startTime, endTime, isBreak, staffId, subjectId } = body;

    if (!Number.isInteger(sectionId)) return NextResponse.json({ error: "Invalid section ID" }, { status: 400 });

    const day = Number(dayOfWeek);
    const resolvedStaffId = staffId ? Number(staffId) : null;
    const resolvedSubjectId = subjectId ? Number(subjectId) : null;

    const sectionConflicts = await db.select({ id: staffAssignments.id })
      .from(staffAssignments)
      .where(and(
        eq(staffAssignments.institutionId, institutionId),
        eq(staffAssignments.sectionId, sectionId),
        eq(staffAssignments.dayOfWeek, day),
        lt(staffAssignments.startTime, endTime),
        gt(staffAssignments.endTime, startTime),
      ))
      .limit(1);
    if (sectionConflicts.length > 0) {
      return NextResponse.json({ error: "This section already has a timetable entry in that time range" }, { status: 409 });
    }

    if (resolvedStaffId) {
      const staffConflicts = await db.select({ id: staffAssignments.id })
        .from(staffAssignments)
        .where(and(
          eq(staffAssignments.institutionId, institutionId),
          eq(staffAssignments.staffId, resolvedStaffId),
          eq(staffAssignments.dayOfWeek, day),
          lt(staffAssignments.startTime, endTime),
          gt(staffAssignments.endTime, startTime),
        ))
        .limit(1);
      if (staffConflicts.length > 0) {
        return NextResponse.json({ error: "This staff member is already booked in that time range" }, { status: 409 });
      }
    }

    const [inserted] = await db.insert(staffAssignments).values({
      institutionId,
      sectionId,
      dayOfWeek: day,
      startTime,
      endTime,
      isBreak: Boolean(isBreak),
      staffId: resolvedStaffId,
      subjectId: resolvedSubjectId,
    }).returning({ id: staffAssignments.id });

    // Invalidate caches
    const { redis } = await import("@/lib/redis");
    await redis.del(`cache:timetable:student:${institutionId}:${sectionId}`).catch(() => {});
    if (resolvedStaffId) {
    await Promise.all([
      redis.del(`cache:timetable:staff:${institutionId}:${resolvedStaffId}`),
      redis.del(`cache:timetable:staff:v2:${institutionId}:${resolvedStaffId}`),
      redis.del(`cache:staff:dashboard:v2:${institutionId}:${resolvedStaffId}`),
    ]).catch(() => {});
    }

    return NextResponse.json({ id: inserted.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create assignment" }, { status: 500 });
  }
});

export const DELETE = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));

  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const [assignment] = await db.select().from(staffAssignments)
    .where(and(eq(staffAssignments.id, id), eq(staffAssignments.institutionId, institutionId)))
    .limit(1);

  if (assignment) {
    await db.delete(staffAssignments).where(eq(staffAssignments.id, id));
    const { redis } = await import("@/lib/redis");
    await redis.del(`cache:timetable:student:${institutionId}:${assignment.sectionId}`).catch(() => {});
    if (assignment.staffId) {
      await Promise.all([
        redis.del(`cache:timetable:staff:${institutionId}:${assignment.staffId}`),
        redis.del(`cache:timetable:staff:v2:${institutionId}:${assignment.staffId}`),
        redis.del(`cache:staff:dashboard:v2:${institutionId}:${assignment.staffId}`),
      ]).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
});
