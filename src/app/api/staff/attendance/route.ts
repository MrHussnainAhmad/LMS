import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, sections, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // For a staff member, they could see attendance for sections where they are the classTeacher
    // Or we just return all attendances for sections they are classTeacher of for now
    const staffSections = await db
      .select({ id: sections.id, name: sections.name })
      .from(sections)
      .where(and(eq(sections.classTeacherId, session.userId), eq(sections.institutionId, session.institutionId)));

    if (staffSections.length === 0) {
      return NextResponse.json({ attendance: [] });
    }

    const sectionIds = staffSections.map(s => s.id);

    const classAttendance = await db
      .select({
        id: attendances.id,
        date: attendances.date,
        status: attendances.status,
        studentName: students.name,
        sectionName: sections.name,
      })
      .from(attendances)
      .innerJoin(students, eq(attendances.studentId, students.id))
      .innerJoin(sections, eq(attendances.sectionId, sections.id))
      .where(
        and(
          inArray(attendances.sectionId, sectionIds),
          eq(attendances.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(attendances.date));

    return NextResponse.json({ attendance: classAttendance });
  } catch (error) {
    console.error("Error fetching staff attendance overview:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
});
