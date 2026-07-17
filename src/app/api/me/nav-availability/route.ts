import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  institutions,
  leaveRequests,
  onlineTestSubmissions,
  onlineTests,
  sections,
  staffAssignments,
  students,
  tests,
} from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isOnlineTestActive(createdAt: Date, durationMinutes: number) {
  return createdAt.getTime() + durationMinutes * 60 * 1000 > Date.now();
}

function isCurrentOrFutureExam(date: string, endDate: string | null) {
  return (endDate || date) >= todayDateString();
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({});

  if (session.role === "STUDENT" && session.institutionId) {
    const [student] = await db.select()
      .from(students)
      .where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId)))
      .limit(1);

    if (!student) return NextResponse.json({ studentTests: false, examTimetable: false });

    const [hostedTests, submissions, examRows, instRows] = await Promise.all([
      db.select({
        onlineTestId: onlineTests.id,
        createdAt: onlineTests.createdAt,
        durationMinutes: onlineTests.durationMinutes,
      })
        .from(onlineTests)
        .innerJoin(tests, eq(onlineTests.testId, tests.id))
        .where(and(
          eq(onlineTests.institutionId, session.institutionId),
          eq(tests.classId, student.classId),
          eq(tests.sectionId, student.sectionId),
          eq(tests.createdByRole, "STAFF")
        )),
      db.select({ onlineTestId: onlineTestSubmissions.onlineTestId })
        .from(onlineTestSubmissions)
        .where(and(
          eq(onlineTestSubmissions.institutionId, session.institutionId),
          eq(onlineTestSubmissions.studentId, session.userId)
        )),
      db.select({
        date: tests.date,
        endDate: tests.endDate,
      })
        .from(tests)
        .where(and(
          eq(tests.institutionId, session.institutionId),
          eq(tests.classId, student.classId),
          eq(tests.createdByRole, "INSTITUTION"),
          inArray(tests.type, ["MONTHLY", "MID", "FINAL"])
        )),
      db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
        .from(institutions)
        .where(eq(institutions.id, session.institutionId))
        .limit(1)
    ]);

    const submittedIds = new Set(submissions.map((submission) => submission.onlineTestId));
    return NextResponse.json({
      studentTests: hostedTests.some((test) => !submittedIds.has(test.onlineTestId) && isOnlineTestActive(test.createdAt, test.durationMinutes)),
      examTimetable: examRows.some((exam) => isCurrentOrFutureExam(exam.date, exam.endDate)),
      feeVouchers: instRows[0]?.acceptFeeVouchers || false,
    });
  }

  if (session.role === "STAFF" && session.institutionId) {
    const assignedRows = await db.select({ classId: sections.classId })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

    const classIds = Array.from(new Set(assignedRows.map((row) => row.classId)));
    
    // Check pending leaves for students in this teacher's sections
    const pendingLeaves = await db.select({ id: leaveRequests.id })
      .from(leaveRequests)
      .innerJoin(students, eq(leaveRequests.userId, students.id))
      .innerJoin(sections, eq(students.sectionId, sections.id))
      .where(and(
        eq(leaveRequests.institutionId, session.institutionId),
        eq(leaveRequests.userRole, "STUDENT"),
        eq(leaveRequests.status, "PENDING"),
        eq(sections.classTeacherId, session.userId)
      )).limit(1);

    if (classIds.length === 0) return NextResponse.json({ examTimetable: false, staffLeaves: pendingLeaves.length > 0 });

    const examRows = await db.select({
      date: tests.date,
      endDate: tests.endDate,
    })
      .from(tests)
      .where(and(
        eq(tests.institutionId, session.institutionId),
        inArray(tests.classId, classIds),
        eq(tests.createdByRole, "INSTITUTION"),
        inArray(tests.type, ["MONTHLY", "MID", "FINAL"])
      ));

    return NextResponse.json({
      examTimetable: examRows.some((exam) => isCurrentOrFutureExam(exam.date, exam.endDate)),
      staffLeaves: pendingLeaves.length > 0,
    });
  }

  if (session.role === "INSTITUTION" && session.institutionId) {
    const pendingStaffLeaves = await db.select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.institutionId, session.institutionId),
        eq(leaveRequests.userRole, "STAFF"),
        eq(leaveRequests.status, "PENDING")
      )).limit(1);

    return NextResponse.json({
      institutionLeaves: pendingStaffLeaves.length > 0,
    });
  }

  return NextResponse.json({});
}
