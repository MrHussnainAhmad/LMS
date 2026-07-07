import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, sections, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray } from "drizzle-orm";
import { staffAssignments, classes } from "@/db/schema";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Only fetch sections where this staff member is explicitly set as the class incharge
    const assignments = await db.selectDistinct({
      id: sections.id,
      name: sections.name,
      classId: sections.classId,
      className: classes.name,
    })
      .from(sections)
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(eq(sections.classTeacherId, session.userId), eq(sections.institutionId, session.institutionId)));

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

    // Authorization: only the class incharge can mark attendance
    const [section] = await db.select({ classTeacherId: sections.classTeacherId })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.institutionId, session.institutionId)));

    if (!section || section.classTeacherId !== session.userId) {
      return NextResponse.json({ error: "You are not authorized to mark attendance for this class. Only the designated Class Incharge can do this." }, { status: 403 });
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

    const { createBulkNotifications } = await import("@/lib/notifications");
    const notifyList = records
      .filter(r => r.status === "ABSENT" || r.status === "LEAVE" || r.status === "LATE")
      .map(r => ({ userId: r.studentId, status: r.status }));

    await createBulkNotifications(notifyList.map((n: any) => ({
      institutionId: session.institutionId!,
      userRole: "STUDENT",
      userId: n.userId,
      type: "ATTENDANCE",
      title: "Attendance Alert",
      message: `You have been marked ${n.status} for ${date.split("T")[0]}.`,
    })));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting attendance:", error);
    return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
  }
});
