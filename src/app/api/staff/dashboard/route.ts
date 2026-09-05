import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  assignments,
  classes,
  sections,
  staff,
  staffAssignments,
  subjects,
} from "@/db/schema";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { getCachedOrFetch } from "@/lib/redis";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { and, eq, gt } from "drizzle-orm";
import { isInstitutionCourseStreamingConfigured } from "@/lib/course-streaming";

const DASHBOARD_CACHE_TTL_SECONDS = 45;

type DashboardPayload = {
  firstName: string;
  /** Kept for mobile client shape; unread is loaded when the notification UI opens. */
  unreadNotificationsCount: number;
  timetable: Array<{ dayOfWeek: number; startTime: string; endTime: string; subjectName: string | null; className: string | null; sectionName: string | null }>;
  assignments: Array<{ id: number; title: string; dueAt: string; className: string | null; sectionName: string | null; subjectName: string | null }>;
  announcements: Array<{ id: number; title: string; content: string; createdAtIso: string; senderRole?: string; isRead: boolean }>;
};

export const GET = requireRole(["STAFF"], async (_req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const staffId = session.userId;
  const cacheKey = `cache:staff:dashboard:v2:${tenantId}:${staffId}`;

  const payload = await getCachedOrFetch(cacheKey, DASHBOARD_CACHE_TTL_SECONDS, async (): Promise<DashboardPayload | { error: string }> => {
    const [staffRow] = await db
      .select({ name: staff.name })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.institutionId, tenantId)))
      .limit(1);

    if (!staffRow) {
      return { error: "Staff not found" };
    }

    const firstName = staffRow.name.trim().split(" ")[0] || "Staff";
    const todayDayOfWeek = new Date().getDay();

    const [timetableRows, assignedSections, visibleAnnouncements] = await Promise.all([
      db.select({
        dayOfWeek: staffAssignments.dayOfWeek,
        startTime: staffAssignments.startTime,
        endTime: staffAssignments.endTime,
        subjectName: subjects.name,
        className: classes.name,
        sectionName: sections.name,
      })
        .from(staffAssignments)
        .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
        .leftJoin(sections, eq(staffAssignments.sectionId, sections.id))
        .leftJoin(classes, eq(sections.classId, classes.id))
        .where(and(
          eq(staffAssignments.staffId, staffId),
          eq(staffAssignments.institutionId, tenantId),
          eq(staffAssignments.dayOfWeek, todayDayOfWeek),
        )),
      db.selectDistinct({ sectionId: staffAssignments.sectionId })
        .from(staffAssignments)
        .where(and(eq(staffAssignments.staffId, staffId), eq(staffAssignments.institutionId, tenantId)))
        .orderBy(staffAssignments.sectionId)
        .limit(1),
      getVisibleAnnouncements(session, 3),
    ]);

    const previewSectionId = assignedSections[0]?.sectionId ?? null;

    const upcomingAssignmentRows = previewSectionId
      ? await db.select({
        id: assignments.id,
        title: assignments.title,
        dueAt: assignments.dueAt,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
      })
        .from(assignments)
        .innerJoin(classes, eq(assignments.classId, classes.id))
        .leftJoin(sections, eq(assignments.sectionId, sections.id))
        .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .where(and(
          eq(assignments.institutionId, tenantId),
          eq(assignments.staffId, staffId),
          eq(assignments.sectionId, previewSectionId),
          gt(assignments.dueAt, new Date()),
        ))
        .orderBy(assignments.dueAt)
        .limit(3)
      : [];

    return {
      firstName,
      unreadNotificationsCount: 0,
      timetable: timetableRows,
      assignments: upcomingAssignmentRows.map((a) => ({
        id: a.id,
        title: a.title,
        dueAt: a.dueAt instanceof Date ? a.dueAt.toISOString() : String(a.dueAt),
        className: a.className,
        sectionName: a.sectionName,
        subjectName: a.subjectName,
      })),
      announcements: visibleAnnouncements.slice(0, 3).map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        createdAtIso: a.createdAtIso,
        senderRole: a.senderRole,
        isRead: a.isRead,
      })),
    };
  });

  if ("error" in payload) {
    return NextResponse.json(payload, { status: 404 });
  }

  const coursesEnabled = await isInstitutionCourseStreamingConfigured(tenantId);
  return NextResponse.json({ ...payload, coursesEnabled });
});
