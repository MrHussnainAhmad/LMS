import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  assignments,
  marks,
  staff,
  staffAssignments,
  students,
  subjects,
  submissions,
  tests,
} from "@/db/schema";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { getCachedOrFetch } from "@/lib/redis";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { isInstitutionCourseStreamingConfigured } from "@/lib/course-streaming";

const DASHBOARD_CACHE_TTL_SECONDS = 45;
const TIMETABLE_CACHE_TTL_SECONDS = 300;

type DashboardPayload = {
  firstName: string;
  latestScore: string;
  /** Kept for mobile client shape; unread is loaded when the notification UI opens. */
  unreadNotificationsCount: number;
  hasPushToken: boolean;
  /** Static nav hints — not probed from DB on home load. */
  hasExams: boolean;
  hasTests: boolean;
  hasTranscripts: boolean;
  hasFeeVouchers: boolean;
  timetable: Array<{ dayOfWeek: number; startTime: string; endTime: string; subjectName: string | null; teacherName: string | null }>;
  assignments: Array<{ id: number; title: string; dueAt: string; submission: null }>;
  announcements: Array<{ id: number; title: string; content?: string; createdAtIso?: string; senderRole?: string }>;
};

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  const startTime = performance.now();
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const tenantId = getTenantContext(session);
  const cacheKey = `cache:student:dashboard:${session.userId}:${tenantId}`;

  let isCacheHit = true;

  const payload = await getCachedOrFetch(cacheKey, DASHBOARD_CACHE_TTL_SECONDS, async (): Promise<DashboardPayload | { error: string }> => {
    isCacheHit = false;

    const [student] = await db
      .select({
        name: students.name,
        classId: students.classId,
        sectionId: students.sectionId,
        campusId: students.campusId,
        createdAt: students.createdAt,
        academicStatus: students.academicStatus,
        expoPushToken: students.expoPushToken,
      })
      .from(students)
      .where(and(eq(students.id, session.userId), eq(students.institutionId, tenantId)))
      .limit(1);

    if (!student) {
      return { error: "Student not found" };
    }

    const firstName = student.name.trim().split(" ")[0] || "Student";

    // Graduated students only get the profile/transcripts/attendance surface —
    // keep the payload minimal (no timetable/assignments/marks history).
    if (student.academicStatus === "GRADUATED") {
      return {
        firstName,
        latestScore: "N/A",
        unreadNotificationsCount: 0,
        hasPushToken: Boolean(student.expoPushToken),
        hasExams: false,
        hasTests: false,
        hasTranscripts: true,
        hasFeeVouchers: false,
        timetable: [],
        assignments: [],
        announcements: [],
      };
    }

    const classId = student.classId;
    const sectionId = student.sectionId;
    const todayDayOfWeek = new Date().getDay();
    const timetableCacheKey = `cache:timetable:${tenantId}:${sectionId}:${todayDayOfWeek}`;

    const [timetableRows, pendingAssignmentRows, latestMarkRow, visibleAnnouncements] = await Promise.all([
      getCachedOrFetch(timetableCacheKey, TIMETABLE_CACHE_TTL_SECONDS, async () => {
        return db.select({
          dayOfWeek: staffAssignments.dayOfWeek,
          startTime: staffAssignments.startTime,
          endTime: staffAssignments.endTime,
          subjectName: subjects.name,
          teacherName: staff.name,
        })
          .from(staffAssignments)
          .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
          .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
          .where(and(
            eq(staffAssignments.sectionId, sectionId),
            eq(staffAssignments.institutionId, tenantId),
            eq(staffAssignments.dayOfWeek, todayDayOfWeek),
          ));
      }),
      db.select({
        id: assignments.id,
        title: assignments.title,
        dueAt: assignments.dueAt,
      })
        .from(assignments)
        .leftJoin(submissions, and(
          eq(submissions.assignmentId, assignments.id),
          eq(submissions.studentId, session.userId),
          eq(submissions.institutionId, tenantId),
        ))
        .where(and(
          eq(assignments.institutionId, tenantId),
          eq(assignments.classId, classId),
          or(eq(assignments.sectionId, sectionId), isNull(assignments.sectionId)),
          isNull(submissions.id),
        ))
        .orderBy(assignments.dueAt)
        .limit(5),
      db.select({
        marksObtained: marks.marksObtained,
        totalMarks: marks.totalMarks,
      })
        .from(marks)
        .innerJoin(tests, eq(marks.testId, tests.id))
        .where(and(eq(marks.studentId, session.userId), eq(marks.institutionId, tenantId), isNotNull(tests.resultsPublishedAt)))
        .orderBy(desc(tests.date), desc(marks.id))
        .limit(1)
        .then(([row]) => row ?? null),
      getVisibleAnnouncements(
        session,
        2,
        {
          campusId: student.campusId,
          classId: student.classId,
          sectionId: student.sectionId,
          createdAt: student.createdAt,
        },
        { includeReadStatus: false }
      ),
    ]);

    const latestScore = latestMarkRow && latestMarkRow.totalMarks
      ? `${Math.round((latestMarkRow.marksObtained / latestMarkRow.totalMarks) * 100)}%`
      : "N/A";

    return {
      firstName,
      latestScore,
      unreadNotificationsCount: 0,
      hasPushToken: Boolean(student.expoPushToken),
      // Nav availability is static for active students; section pages load their own data.
      hasExams: true,
      hasTests: true,
      hasTranscripts: true,
      hasFeeVouchers: true,
      timetable: timetableRows,
      assignments: pendingAssignmentRows.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt instanceof Date ? a.dueAt.toISOString() : String(a.dueAt),
        submission: null,
      })),
      announcements: visibleAnnouncements.slice(0, 2).map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        createdAtIso: a.createdAtIso,
        senderRole: a.senderRole,
      })),
    };
  });

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const headers = new Headers({
    "x-request-id": requestId,
    "x-cache": isCacheHit ? "HIT" : "MISS",
    "x-dashboard-duration-ms": durationMs.toString(),
    "server-timing": `total;dur=${durationMs}`,
  });

  if ("error" in payload) {
    return NextResponse.json(payload, { status: 404, headers });
  }

  const coursesEnabled = await isInstitutionCourseStreamingConfigured(tenantId);
  return NextResponse.json({ ...payload, coursesEnabled }, { headers });
});
