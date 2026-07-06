"use server";

import { db } from "@/db";
import { campuses, staff, classes, sections, subjects, announcements } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { staffAssignments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hash } from "@node-rs/argon2";

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export async function createCampusAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const address = formData.get("address") as string;

  await db.insert(campuses).values({
    institutionId,
    name,
    address,
  });

  revalidatePath("/institution/campuses");
  return { success: true };
}

export async function createStaffAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const campusIdRaw = formData.get("campusId") as string;
  const campusId = campusIdRaw ? parseInt(campusIdRaw, 10) : null;

  // Generate a slug email: john-doe@inst_slug.lms
  const baseSlug = generateSlug(name);
  const randomSuffix = Math.floor(Math.random() * 10000);
  const email = `${baseSlug}-${randomSuffix}@inst-${institutionId}.lms`;

  const passwordHash = await hash(password);

  await db.insert(staff).values({
    institutionId,
    name,
    phone,
    email,
    passwordHash,
    campusId,
    mustChangePassword: true,
  });

  revalidatePath("/institution/staff");
  return { success: true };
}

export async function createSubjectAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;

  await db.insert(subjects).values({
    institutionId,
    name,
    code,
  });

  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createAnnouncementAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const targetType = formData.get("targetType") as "ALL" | "CAMPUS" | "CLASS" | "SECTION";

  await db.insert(announcements).values({
    institutionId,
    senderRole: "INSTITUTION",
    senderId: institutionId,
    title,
    content,
    targetType,
  });

  revalidatePath("/institution/announcements");
  return { success: true };
}

export async function createClassAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const levelRaw = formData.get("level") as string;
  const level = levelRaw ? parseInt(levelRaw, 10) : 0;

  await db.insert(classes).values({
    institutionId,
    name,
    level,
  });

  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createSectionAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const classId = parseInt(formData.get("classId") as string, 10);
  const classTeacherIdRaw = formData.get("classTeacherId") as string;
  const classTeacherId = classTeacherIdRaw ? parseInt(classTeacherIdRaw, 10) : null;

  await db.insert(sections).values({
    institutionId,
    name,
    classId,
    classTeacherId,
  });

  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createTimetableAssignmentAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const sectionId = parseInt(formData.get("sectionId") as string, 10);
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string, 10);
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  
  const isBreakRaw = formData.get("isBreak");
  const isBreak = isBreakRaw === "on" || isBreakRaw === "true";
  
  const staffIdRaw = formData.get("staffId");
  const subjectIdRaw = formData.get("subjectId");
  const staffId = staffIdRaw && !isBreak ? parseInt(staffIdRaw as string, 10) : null;
  const subjectId = subjectIdRaw && !isBreak ? parseInt(subjectIdRaw as string, 10) : null;

  await db.insert(staffAssignments).values({
    institutionId,
    staffId,
    sectionId,
    subjectId,
    isBreak,
    dayOfWeek,
    startTime,
    endTime,
  });

  revalidatePath("/institution/timetable");
  return { success: true };
}
