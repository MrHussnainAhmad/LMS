"use server";

import { db } from "@/db";
import { attendances, announcements } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function submitAttendanceAction(
  sectionId: number,
  date: Date,
  records: { studentId: number; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }[]
) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") throw new Error("Unauthorized");

  const institutionId = session.institutionId;
  if (!institutionId) throw new Error("No institution bound");

  // We should upsert attendance for this section/date to avoid dupes
  // Drizzle onConflictDoUpdate requires specifying constraints
  for (const record of records) {
    await db.insert(attendances).values({
      institutionId,
      sectionId,
      studentId: record.studentId,
      date: date.toISOString().split("T")[0],
      status: record.status
    }).onConflictDoUpdate({
      target: [attendances.studentId, attendances.date],
      set: { status: record.status }
    });
  }

  return { success: true };
}

export async function createStaffAnnouncementAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") throw new Error("Unauthorized");

  const institutionId = session.institutionId;
  if (!institutionId) throw new Error("No institution bound");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const targetType = formData.get("targetType") as any;
  const targetClassId = formData.get("targetClassId") ? parseInt(formData.get("targetClassId") as string) : null;
  const targetSectionId = formData.get("targetSectionId") ? parseInt(formData.get("targetSectionId") as string) : null;

  await db.insert(announcements).values({
    institutionId,
    senderRole: "STAFF",
    senderId: session.userId,
    targetType,
    targetClassId,
    targetSectionId,
    title,
    content
  });

  return { success: true };
}
