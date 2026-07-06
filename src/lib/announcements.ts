import { db } from "@/db";
import { announcementReads, announcements, staffAssignments, students, sections } from "@/db/schema";
import type { JWTPayload } from "@/lib/auth-types";
import { and, desc, eq, inArray } from "drizzle-orm";

export type VisibleAnnouncement = {
  id: number;
  title: string;
  content: string;
  targetType: "ALL" | "CAMPUS" | "CLASS" | "SECTION";
  senderRole: JWTPayload["role"];
  createdAtLabel: string;
  isRead: boolean;
};

export function formatAnnouncementDate(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

async function getStudentScope(userId: number, institutionId: number) {
  const [student] = await db.select().from(students).where(and(eq(students.id, userId), eq(students.institutionId, institutionId))).limit(1);
  return student
    ? { campusId: student.campusId, classIds: [student.classId], sectionIds: [student.sectionId] }
    : { campusId: null, classIds: [], sectionIds: [] };
}

async function getStaffScope(userId: number, institutionId: number, campusId?: number | null) {
  const rows = await db.select({
    classId: sections.classId,
    sectionId: sections.id,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .where(and(eq(staffAssignments.staffId, userId), eq(staffAssignments.institutionId, institutionId)));

  return {
    campusId: campusId ?? null,
    classIds: Array.from(new Set(rows.map((row) => row.classId))),
    sectionIds: Array.from(new Set(rows.map((row) => row.sectionId))),
  };
}

async function getScope(session: JWTPayload) {
  const institutionId = session.role === "INSTITUTION" ? session.userId : session.institutionId;
  if (!institutionId) return null;

  if (session.role === "STUDENT") return { institutionId, ...(await getStudentScope(session.userId, institutionId)) };
  if (session.role === "STAFF") return { institutionId, ...(await getStaffScope(session.userId, institutionId, session.campusId)) };
  if (session.role === "INSTITUTION") return { institutionId, campusId: null, classIds: [], sectionIds: [] };

  return null;
}

function canSeeAnnouncement(
  session: JWTPayload,
  scope: Awaited<ReturnType<typeof getScope>>,
  announcement: typeof announcements.$inferSelect
) {
  if (!scope) return false;
  if (session.role === "INSTITUTION") return true;
  if (announcement.senderRole === session.role && announcement.senderId === session.userId) return true;
  if (announcement.targetType === "ALL") return true;
  if (announcement.targetType === "CAMPUS") return Boolean(scope.campusId && announcement.targetCampusId === scope.campusId);
  if (announcement.targetType === "CLASS") return Boolean(announcement.targetClassId && scope.classIds.includes(announcement.targetClassId));
  if (announcement.targetType === "SECTION") return Boolean(announcement.targetSectionId && scope.sectionIds.includes(announcement.targetSectionId));
  return false;
}

export async function getVisibleAnnouncements(session: JWTPayload, limit = 4) {
  const scope = await getScope(session);
  if (!scope) return [];

  const rows = await db.select()
    .from(announcements)
    .where(eq(announcements.institutionId, scope.institutionId))
    .orderBy(desc(announcements.createdAt))
    .limit(50);

  const visibleRows = rows.filter((announcement) => canSeeAnnouncement(session, scope, announcement)).slice(0, limit);
  if (visibleRows.length === 0) return [];

  const readRows = await db.select()
    .from(announcementReads)
    .where(
      and(
        eq(announcementReads.userRole, session.role),
        eq(announcementReads.userId, session.userId),
        inArray(announcementReads.announcementId, visibleRows.map((announcement) => announcement.id))
      )
    );

  const readIds = new Set(readRows.map((row) => row.announcementId));

  return visibleRows.map((announcement): VisibleAnnouncement => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    createdAtLabel: formatAnnouncementDate(announcement.createdAt),
    isRead: readIds.has(announcement.id),
  }));
}

export async function getVisibleAnnouncementById(session: JWTPayload, id: number) {
  const scope = await getScope(session);
  if (!scope) return null;

  const [announcement] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.institutionId, scope.institutionId))).limit(1);
  if (!announcement || !canSeeAnnouncement(session, scope, announcement)) return null;

  const [read] = await db.select()
    .from(announcementReads)
    .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.userRole, session.role), eq(announcementReads.userId, session.userId)))
    .limit(1);

  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    createdAtLabel: formatAnnouncementDate(announcement.createdAt),
    isRead: Boolean(read),
  };
}

export async function markAnnouncementRead(session: JWTPayload, id: number) {
  const announcement = await getVisibleAnnouncementById(session, id);
  if (!announcement) throw new Error("Announcement not found");

  await db.insert(announcementReads).values({
    announcementId: id,
    userRole: session.role,
    userId: session.userId,
  }).onConflictDoNothing();
}
