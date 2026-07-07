import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, sections, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray } from "drizzle-orm";
import { staffAssignments, classes } from "@/db/schema";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Get distinct sections assigned to this staff member (matching web app logic)
    const assignments = await db.selectDistinct({
      id: sections.id,
      name: sections.name,
      classId: sections.classId,
      className: classes.name,
    })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

    const sectionIds = assignments.map(a => a.id);

    // 2. Fetch all students for these sections
    const allStudents = sectionIds.length > 0 ? await db.select({
      id: students.id,
      name: students.name,
      loginRollNumber: students.loginRollNumber,
      sectionId: students.sectionId,
    })
      .from(students)
      .where(and(eq(students.institutionId, session.institutionId), inArray(students.sectionId, sectionIds))) : [];

    const studentsBySection: Record<number, any[]> = {};
    allStudents.forEach(student => {
      if (!studentsBySection[student.sectionId]) {
        studentsBySection[student.sectionId] = [];
      }
      studentsBySection[student.sectionId].push(student);
    });

    // 3. Fetch historical attendance for overview (limit to these sections)
    let classAttendance: any[] = [];
    if (sectionIds.length > 0) {
      classAttendance = await db
        .select({
          id: attendances.id,
          date: attendances.date,
          status: attendances.status,
          studentName: students.name,
          sectionId: attendances.sectionId,
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
    }

    return NextResponse.json({ 
      attendance: classAttendance,
      assignedSections: assignments,
      studentsBySection
    });
  } catch (error) {
    console.error("Error fetching staff attendance overview:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
});

export const POST = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { sectionId, date, records } = body as {
      sectionId: number;
      date: string;
      records: { studentId: number; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }[];
    };

    if (!sectionId || !date || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Upsert attendance
    for (const record of records) {
      await db.insert(attendances).values({
        institutionId: session.institutionId,
        sectionId,
        studentId: record.studentId,
        date: date.split("T")[0],
        status: record.status
      }).onConflictDoUpdate({
        target: [attendances.studentId, attendances.date],
        set: { status: record.status }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting attendance:", error);
    return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
  }
});
