import { db } from "@/db";
import { announcementReads, announcements, staff, staffAssignments, students, sections } from "@/db/schema";
import type { JWTPayload } from "@/lib/auth-types";
import { and, desc, eq, inArray, gte, isNull, or } from "drizzle-orm";
import { getUserCreatedAt } from "@/lib/user";
import { getCachedOrFetch } from "@/lib/redis";

export type AnnouncementRecipientRole = "STUDENT" | "STAFF";

export type AnnouncementRecipient = {
  userRole: AnnouncementRecipientRole;
  userId: number;
};

export type VisibleAnnouncement = {
  id: number;
  title: string;
  content: string;
  targetType: "ALL" | "CAMPUS" | "CLASS" | "SECTION" | "USER";
  senderRole: JWTPayload["role"];
  createdAtIso: string;
  isRead: boolean;
};

type AnnouncementRow = typeof announcements.$inferSelect;

function getSessionInstitutionId(session: JWTPayload) {
  return session.role === "INSTITUTION" ? session.userId : session.institutionId;
}

function addRecipient(
  recipients: Map<string, AnnouncementRecipient>,
  announcement: AnnouncementRow,
  userRole: AnnouncementRecipientRole,
  userId: number | null
) {
  if (!userId) return;
  if (announcement.senderRole === userRole && announcement.senderId === userId) return;
  recipients.set(`${userRole}:${userId}`, { userRole, userId });
}

export async function resolveAnnouncementRecipients(announcement: AnnouncementRow): Promise<AnnouncementRecipient[]> {
  const recipients = new Map<string, AnnouncementRecipient>();
  const includeStaffAudience = announcement.senderRole === "INSTITUTION";

  if (announcement.targetType === "ALL") {
    const allStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.institutionId, announcement.institutionId));

    allStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const allStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(eq(staff.institutionId, announcement.institutionId));

      allStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "CAMPUS" && announcement.targetCampusId) {
    const campusStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.campusId, announcement.targetCampusId)
      ));

    campusStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const campusStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(and(
          eq(staff.institutionId, announcement.institutionId),
          eq(staff.campusId, announcement.targetCampusId)
        ));

      campusStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "CLASS" && announcement.targetClassId) {
    const classStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.classId, announcement.targetClassId)
      ));

    classStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const classStaff = await db
        .select({ id: staffAssignments.staffId })
        .from(staffAssignments)
        .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
        .where(and(
          eq(staffAssignments.institutionId, announcement.institutionId),
          eq(sections.institutionId, announcement.institutionId),
          eq(sections.classId, announcement.targetClassId)
        ));

      classStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "SECTION" && announcement.targetSectionId) {
    const sectionStudents = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.institutionId, announcement.institutionId),
        eq(students.sectionId, announcement.targetSectionId)
      ));

    sectionStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));

    if (includeStaffAudience) {
      const sectionStaff = await db
        .select({ id: staffAssignments.staffId })
        .from(staffAssignments)
        .where(and(
          eq(staffAssignments.institutionId, announcement.institutionId),
          eq(staffAssignments.sectionId, announcement.targetSectionId)
        ));

      sectionStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
    }
  } else if (announcement.targetType === "USER" && announcement.targetUserRole) {
    if (announcement.targetUserRole === "STUDENT") {
      if (announcement.targetUserId) {
        addRecipient(recipients, announcement, "STUDENT", announcement.targetUserId);
      } else {
        const roleStudents = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.institutionId, announcement.institutionId));

        roleStudents.forEach((student) => addRecipient(recipients, announcement, "STUDENT", student.id));
      }
    } else if (announcement.targetUserRole === "STAFF") {
      if (announcement.targetUserId) {
        addRecipient(recipients, announcement, "STAFF", announcement.targetUserId);
      } else {
        const roleStaff = await db
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.institutionId, announcement.institutionId));

        roleStaff.forEach((staffMember) => addRecipient(recipients, announcement, "STAFF", staffMember.id));
      }
    }
  }

  return Array.from(recipients.values());
}

async function isAnnouncementRecipient(announcement: AnnouncementRow, session: JWTPayload) {
  if (session.role !== "STUDENT" && session.role !== "STAFF") return false;
  const recipients = await resolveAnnouncementRecipients(announcement);
  return recipients.some((recipient) => recipient.userRole === session.role && recipient.userId === session.userId);
}

function canViewSentOrManagedAnnouncement(announcement: AnnouncementRow, session: JWTPayload) {
  if (announcement.senderRole === session.role && announcement.senderId === session.userId) return true;
  return session.role === "INSTITUTION" && announcement.institutionId === session.userId;
}

function toVisibleAnnouncement(announcement: AnnouncementRow, isRead: boolean): VisibleAnnouncement {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    createdAtIso: announcement.createdAt.toISOString(),
    isRead,
  };
}

export async function getVisibleAnnouncements(session: JWTPayload, limit = 4) {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) return [];

  let visibleRows: AnnouncementRow[] = [];
  const cacheKey = `cache:announcements:visible:${institutionId}:${session.role}:${session.userId}`;

  visibleRows = await getCachedOrFetch(cacheKey, 60, async () => {
    let rows: AnnouncementRow[] = [];
    if (session.role === "INSTITUTION") {
      rows = await db.select()
        .from(announcements)
        .where(eq(announcements.institutionId, institutionId))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    } else if (session.role === "STUDENT") {
      const [student] = await db.select({
        campusId: students.campusId,
        classId: students.classId,
        sectionId: students.sectionId,
        createdAt: students.createdAt,
      }).from(students).where(and(eq(students.id, session.userId), eq(students.institutionId, institutionId))).limit(1);
      if (!student) return [];

      rows = await db.select()
        .from(announcements)
        .where(and(
          eq(announcements.institutionId, institutionId),
          gte(announcements.createdAt, student.createdAt),
          or(
            eq(announcements.targetType, "ALL"),
            student.campusId ? and(eq(announcements.targetType, "CAMPUS"), eq(announcements.targetCampusId, student.campusId)) : undefined,
            and(eq(announcements.targetType, "CLASS"), eq(announcements.targetClassId, student.classId)),
            and(eq(announcements.targetType, "SECTION"), eq(announcements.targetSectionId, student.sectionId)),
            and(
              eq(announcements.targetType, "USER"),
              eq(announcements.targetUserRole, "STUDENT"),
              or(eq(announcements.targetUserId, session.userId), isNull(announcements.targetUserId))
            )
          )
        ))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    } else if (session.role === "STAFF") {
      const [staffMember, assignedScopes] = await Promise.all([
        db.select({ campusId: staff.campusId, createdAt: staff.createdAt })
          .from(staff)
          .where(and(eq(staff.id, session.userId), eq(staff.institutionId, institutionId)))
          .limit(1),
        db.select({ sectionId: staffAssignments.sectionId, classId: sections.classId })
          .from(staffAssignments)
          .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
          .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, institutionId))),
      ]);
      if (!staffMember[0]) return [];
      const sectionIds = Array.from(new Set(assignedScopes.map((scope) => scope.sectionId)));
      const classIds = Array.from(new Set(assignedScopes.map((scope) => scope.classId)));

      rows = await db.select()
        .from(announcements)
        .where(and(
          eq(announcements.institutionId, institutionId),
          gte(announcements.createdAt, staffMember[0].createdAt),
          eq(announcements.senderRole, "INSTITUTION"),
          or(
            eq(announcements.targetType, "ALL"),
            staffMember[0].campusId ? and(eq(announcements.targetType, "CAMPUS"), eq(announcements.targetCampusId, staffMember[0].campusId)) : undefined,
            classIds.length ? and(eq(announcements.targetType, "CLASS"), inArray(announcements.targetClassId, classIds)) : undefined,
            sectionIds.length ? and(eq(announcements.targetType, "SECTION"), inArray(announcements.targetSectionId, sectionIds)) : undefined,
            and(
              eq(announcements.targetType, "USER"),
              eq(announcements.targetUserRole, "STAFF"),
              or(eq(announcements.targetUserId, session.userId), isNull(announcements.targetUserId))
            )
          )
        ))
        .orderBy(desc(announcements.createdAt))
        .limit(limit);
    }
    return rows;
  });

  // Re-parse createdAt to Date objects since JSON stringifies them
  visibleRows = visibleRows.map(row => ({
    ...row,
    createdAt: new Date(row.createdAt),
  }));

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
  return visibleRows.map((announcement) => toVisibleAnnouncement(announcement, readIds.has(announcement.id)));
}

export async function getVisibleAnnouncementById(session: JWTPayload, id: number) {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) return null;

  const userCreatedAt = await getUserCreatedAt(session);

  const [announcement] = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.id, id), 
        eq(announcements.institutionId, institutionId),
        gte(announcements.createdAt, userCreatedAt)
      )
    )
    .limit(1);

  if (!announcement) return null;

  const isRecipient = await isAnnouncementRecipient(announcement, session);
  const canViewSent = canViewSentOrManagedAnnouncement(announcement, session);
  if (!isRecipient && !canViewSent) return null;

  if (!isRecipient) return toVisibleAnnouncement(announcement, true);

  const [read] = await db.select()
    .from(announcementReads)
    .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.userRole, session.role), eq(announcementReads.userId, session.userId)))
    .limit(1);

  return toVisibleAnnouncement(announcement, Boolean(read));
}

export async function markAnnouncementRead(session: JWTPayload, id: number) {
  const institutionId = getSessionInstitutionId(session);
  if (!institutionId) throw new Error("Announcement not found");

  const [announcement] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, id), eq(announcements.institutionId, institutionId)))
    .limit(1);

  if (!announcement) throw new Error("Announcement not found");

  const isRecipient = await isAnnouncementRecipient(announcement, session);
  if (!isRecipient) {
    if (canViewSentOrManagedAnnouncement(announcement, session)) return;
    throw new Error("Announcement not found");
  }

  await db.insert(announcementReads).values({
    announcementId: id,
    userRole: session.role,
    userId: session.userId,
  }).onConflictDoNothing();
}
