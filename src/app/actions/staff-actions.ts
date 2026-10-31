"use server";

import { ActionInputError } from "@/lib/action-input-error";

import { db } from "@/db";
import { announcements, sections, staffAssignments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { createAttendanceNotifications } from "@/lib/notifications";
import { after } from "next/server";
import { saveStudentAttendance } from '@/lib/student-attendance';
import { pakistanDateKey } from '@/lib/parent-period';
import { invalidateStudentAttendanceCaches } from '@/lib/redis';

type AnnouncementTargetType = "ALL" | "CAMPUS" | "CLASS" | "SECTION" | "USER";

export async function submitAttendanceAction(
  sectionId: number,
  date: Date,
  records: { studentId: number; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }[]
) {
  const session = await getSession();
  if (!session) throw new ActionInputError('Unauthorized');
  const result = await saveStudentAttendance(session, { sectionId, date: pakistanDateKey(date), records });
  await invalidateStudentAttendanceCaches(result.institutionId, result.records.map(record => record.studentId));
  after(async () => {
    try { await createAttendanceNotifications(result); }
    catch (error) { console.error('Attendance notification delivery failed:', error); }
  });
  return { success: true, markedByName: result.marker.markedByName, markedByRole: result.marker.markedByRole,
    markedAt: result.marker.markedAt.toISOString() };
}

export async function createStaffAnnouncementAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") throw new ActionInputError("Unauthorized");

  const institutionId = session.institutionId;
  if (!institutionId) throw new ActionInputError("No institution bound");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const targetType = formData.get("targetType") as AnnouncementTargetType;
  const targetClassId = formData.get("targetClassId") ? parseInt(formData.get("targetClassId") as string) : null;
  const targetSectionId = formData.get("targetSectionId") ? parseInt(formData.get("targetSectionId") as string) : null;

  if (!title.trim() || !content.trim()) throw new ActionInputError("Title and content are required");
  if (targetType !== "CLASS" && targetType !== "SECTION") throw new ActionInputError("Invalid target audience");
  if (!targetClassId || !Number.isInteger(targetClassId)) throw new ActionInputError("Class is required");

  const assignedRows = await db.selectDistinct({
    sectionId: sections.id,
    classId: sections.classId,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .where(and(
      eq(staffAssignments.staffId, session.userId),
      eq(staffAssignments.institutionId, institutionId),
      eq(sections.institutionId, institutionId),
      eq(sections.classId, targetClassId),
    ));

  if (assignedRows.length === 0) throw new ActionInputError("This class is not assigned to you");

  if (targetType === "SECTION") {
    if (!targetSectionId || !Number.isInteger(targetSectionId)) throw new ActionInputError("Section is required");
    const selectedSection = assignedRows.find((row) => row.sectionId === targetSectionId);
    if (!selectedSection) throw new ActionInputError("Section not found for the selected class");
  }

  const [inserted] = await db.insert(announcements).values({
    institutionId,
    senderRole: "STAFF",
    senderId: session.userId,
    targetType,
    targetClassId,
    targetSectionId: targetType === "SECTION" ? targetSectionId : null,
    title,
    content
  }).returning({ id: announcements.id });

  const { processAnnouncementNotification } = await import("@/lib/notifications");
  await processAnnouncementNotification(inserted.id);

  return { success: true };
}
