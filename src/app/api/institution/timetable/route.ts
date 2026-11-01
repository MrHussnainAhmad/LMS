import { readBoundedJson } from '@/lib/http';
import { inputErrorResponse } from '@/lib/input-error-response';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { staffAssignments, staff, sections, classes, subjects } from "@/db/schema";
import { sql, eq, and, isNull } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

import { invalidateTimetableReadCaches } from "@/lib/redis";
import { invalidateInstitutionAcademicsCache } from "@/lib/institution-academics-data";
import { getStaffWorkload, saveTeachingCoverage, createTimetableAssignment } from '@/lib/timetable-coverage';

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const url = new URL(req.url);
  if(url.searchParams.get('view')==='workload')return NextResponse.json(await getStaffWorkload(institutionId,url.searchParams.get('date')??undefined),{headers:{'Cache-Control':'private, no-store'}});

  if (url.searchParams.get("metadata") === "true") {
    const [allStaff, allSections, allClasses, allSubjects] = await Promise.all([
      db.select({ id: staff.id, name: staff.name }).from(staff).where(and(eq(staff.institutionId, institutionId), isNull(staff.deletedAt))),
      db.select({ id: sections.id, name: sections.name, classId: sections.classId, classTeacherId: sections.classTeacherId }).from(sections).where(and(eq(sections.institutionId, institutionId), isNull(sections.deletedAt))),
      db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.institutionId, institutionId), isNull(classes.deletedAt))),
      db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.institutionId, institutionId), isNull(subjects.deletedAt))),
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
    const body = await readBoundedJson(req);
    if(body?.action==='teachingCover')return NextResponse.json(await saveTeachingCoverage(session,body));
    
    // Support assigning Incharge
    if (body.action === "updateIncharge") {
      const sectionId = body.sectionId ? Number(body.sectionId) : null;
      const classId = body.classId ? Number(body.classId) : null;
      const classTeacherId = body.classTeacherId ? Number(body.classTeacherId) : null;

      if (body.sectionId && !Number.isInteger(sectionId)) return NextResponse.json({ error: "Invalid section ID" }, { status: 400 });
      if (body.classId && !Number.isInteger(classId)) return NextResponse.json({ error: "Invalid class ID" }, { status: 400 });
      if (body.classTeacherId && !Number.isInteger(classTeacherId)) return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });

      if (classTeacherId) {
        const [teacher] = await db.select({ id: staff.id }).from(staff)
          .where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId), isNull(staff.deletedAt)))
          .limit(1);
        if (!teacher) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
      }
      
      if (sectionId) {
        const updated = await db.update(sections)
          .set({ classTeacherId: classTeacherId || null })
          .where(and(eq(sections.id, sectionId), eq(sections.institutionId, institutionId), isNull(sections.deletedAt)))
          .returning({ id: sections.id });
        if (updated.length === 0) return NextResponse.json({ error: "Section not found" }, { status: 404 });
      } else if (classId) {
        const [wholeClassSection] = await db.select().from(sections)
          .where(and(eq(sections.classId, classId), eq(sections.name, "Whole Class"), eq(sections.institutionId, institutionId), isNull(sections.deletedAt)))
          .limit(1);
        if (wholeClassSection) {
          await db.update(sections)
            .set({ classTeacherId: classTeacherId || null })
            .where(eq(sections.id, wholeClassSection.id));
        } else {
          return NextResponse.json({ error: "Whole Class section not found" }, { status: 404 });
        }
      } else {
        return NextResponse.json({ error: "Section or class is required" }, { status: 400 });
      }
      await invalidateInstitutionAcademicsCache(institutionId);
      return NextResponse.json({ success: true });
    }

    const created=await createTimetableAssignment(session,body);
    return NextResponse.json({id:created.id});
  } catch (error: any) {
    const publicInputError = inputErrorResponse(error);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    return NextResponse.json({ error: error.message || "Failed to create assignment" }, { status: 500 });
  }
});

export const DELETE = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));

  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const assignment=await db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(80429,${institutionId})`);
    const [row]=await tx.select().from(staffAssignments).where(and(eq(staffAssignments.id,id),eq(staffAssignments.institutionId,institutionId))).for('update').limit(1);
    if(row)await tx.delete(staffAssignments).where(eq(staffAssignments.id,id));
    return row;
  });

  if (assignment) {
    await invalidateTimetableReadCaches(institutionId, assignment.sectionId, assignment.staffId);
    await (await import('@/lib/notification-events')).notifyTimetable(institutionId,assignment.sectionId,assignment.staffId,`delete:${assignment.id}`);
  }

  return NextResponse.json({ success: true });
});
