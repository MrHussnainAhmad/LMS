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
import { redis } from "@/lib/redis";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

const NAV_AVAILABILITY_CACHE_TTL_SECONDS = 60;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function jsonWithCache(cacheKey: string | null, payload: Record<string, boolean>) {
  if (cacheKey && redis.status === "ready") {
    await redis.setex(cacheKey, NAV_AVAILABILITY_CACHE_TTL_SECONDS, JSON.stringify(payload)).catch(() => null);
  }
  return NextResponse.json(payload);
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({});

  const cacheKey = session.institutionId
    ? `nav:availability:v1:${session.role}:${session.institutionId}:${session.userId}`
    : null;
  if (cacheKey && redis.status === "ready") {
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return NextResponse.json(JSON.parse(cached));
      } catch {
        // Ignore malformed cache values and refresh them from the database.
      }
    }
  }

  if (session.role === "STUDENT" && session.institutionId) {
    const [student] = await db.select({ classId: students.classId, sectionId: students.sectionId })
      .from(students)
      .where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId)))
      .limit(1);

    if (!student) return jsonWithCache(cacheKey, { studentTests: false, examTimetable: false, feeVouchers: false });

    const now = new Date();
    const today = todayDateString();
    const [activeUntakenTests, currentOrFutureExams, instRows] = await Promise.all([
      db.select({ id: onlineTests.id })
        .from(onlineTests)
        .innerJoin(tests, eq(onlineTests.testId, tests.id))
        .leftJoin(onlineTestSubmissions, and(
          eq(onlineTestSubmissions.onlineTestId, onlineTests.id),
          eq(onlineTestSubmissions.institutionId, session.institutionId),
          eq(onlineTestSubmissions.studentId, session.userId)
        ))
        .where(and(
          eq(onlineTests.institutionId, session.institutionId),
          eq(tests.classId, student.classId),
          eq(tests.sectionId, student.sectionId),
          eq(tests.createdByRole, "STAFF"),
          isNull(onlineTestSubmissions.id),
          sql`${onlineTests.createdAt} + (${onlineTests.durationMinutes} * interval '1 minute') > ${now}`
        ))
        .limit(1),
      db.select({ id: tests.id })
        .from(tests)
        .where(and(
          eq(tests.institutionId, session.institutionId),
          eq(tests.classId, student.classId),
          or(isNull(tests.sectionId), eq(tests.sectionId, student.sectionId)),
          eq(tests.createdByRole, "INSTITUTION"),
          inArray(tests.type, ["MONTHLY", "MID", "FINAL"]),
          sql`coalesce(${tests.endDate}, ${tests.date}) >= ${today}`
        ))
        .limit(1),
      db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
        .from(institutions)
        .where(eq(institutions.id, session.institutionId))
        .limit(1)
    ]);

    return jsonWithCache(cacheKey, {
      studentTests: activeUntakenTests.length > 0,
      examTimetable: currentOrFutureExams.length > 0,
      feeVouchers: instRows[0]?.acceptFeeVouchers || false,
    });
  }

  if (session.role === "STAFF" && session.institutionId) {
    const today = todayDateString();
    const [pendingLeaves, currentOrFutureExams] = await Promise.all([
      db.select({ id: leaveRequests.id })
        .from(leaveRequests)
        .innerJoin(students, eq(leaveRequests.userId, students.id))
        .innerJoin(sections, eq(students.sectionId, sections.id))
        .where(and(
          eq(leaveRequests.institutionId, session.institutionId),
          eq(leaveRequests.userRole, "STUDENT"),
          eq(leaveRequests.status, "PENDING"),
          eq(sections.classTeacherId, session.userId)
        )).limit(1),
      db.select({ id: tests.id })
        .from(staffAssignments)
        .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
        .innerJoin(tests, and(
          eq(tests.classId, sections.classId),
          eq(tests.institutionId, session.institutionId),
          eq(tests.createdByRole, "INSTITUTION"),
          inArray(tests.type, ["MONTHLY", "MID", "FINAL"]),
          sql`coalesce(${tests.endDate}, ${tests.date}) >= ${today}`
        ))
        .where(and(
          eq(staffAssignments.staffId, session.userId),
          eq(staffAssignments.institutionId, session.institutionId)
        ))
        .limit(1),
    ]);

    return jsonWithCache(cacheKey, {
      examTimetable: currentOrFutureExams.length > 0,
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

    return jsonWithCache(cacheKey, {
      institutionLeaves: pendingStaffLeaves.length > 0,
    });
  }

  return NextResponse.json({});
}
