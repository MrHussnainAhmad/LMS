"use server";

import { db } from "@/db";
import { campuses, staff, classes, sections, subjects, announcements, notifications, institutions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { staffAssignments } from "@/db/schema";
import { eq, and, gt, lt, inArray, count } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { generateStaffEmail } from "@/lib/login-identifiers";

const WHOLE_CLASS_SECTION_NAME = "Whole Class";

async function getOrCreateWholeClassSection(institutionId: number, classId: number) {
  const [classRow] = await db.select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId)))
    .limit(1);
  if (!classRow) throw new Error("Class not found");

  const [existingSection] = await db.select({ id: sections.id })
    .from(sections)
    .where(and(
      eq(sections.classId, classId),
      eq(sections.institutionId, institutionId),
      eq(sections.name, WHOLE_CLASS_SECTION_NAME)
    ))
    .limit(1);
  if (existingSection) return existingSection.id;

  const [createdSection] = await db.insert(sections).values({
    institutionId,
    classId,
    name: WHOLE_CLASS_SECTION_NAME,
    classTeacherId: null,
  }).returning({ id: sections.id });

  return createdSection.id;
}

export async function createCampusAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
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
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const phone = ((formData.get("phone") as string) || "").trim();
  const password = formData.get("password") as string;
  const campusIdRaw = formData.get("campusId") as string;
  const campusId = campusIdRaw ? parseInt(campusIdRaw, 10) : null;

  if (phone.replace(/\D/g, "").length < 4) {
    throw new Error("Phone number must include at least 4 digits");
  }

  const [institution] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!institution) throw new Error("Institution not found");

  const baseEmail = generateStaffEmail({ name, phone, institution });
  const [localPart, domain] = baseEmail.split("@");
  let email = baseEmail;
  let count = 0;

  while (true) {
    const [existing] = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
    if (!existing) break;
    count++;
    email = `${localPart}${count}@${domain}`;
  }

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
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

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
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const targetTypeRaw = formData.get("targetType") as string;
  const targetCampusId = parseOptionalId(formData.get("targetCampusId"));
  const targetClassId = parseOptionalId(formData.get("targetClassId"));
  const targetSectionId = parseOptionalId(formData.get("targetSectionId"));

  if (!title.trim() || !content.trim()) throw new Error("Title and content are required");
  if (!["ALL", "STAFF", "CAMPUS", "CLASS", "SECTION"].includes(targetTypeRaw)) throw new Error("Invalid target audience");

  let targetType: "ALL" | "CAMPUS" | "CLASS" | "SECTION" | "USER" = "ALL";
  let targetUserRole: "STAFF" | null = null;
  let resolvedCampusId: number | null = null;
  let resolvedClassId: number | null = null;
  let resolvedSectionId: number | null = null;

  if (targetTypeRaw === "STAFF") {
    targetType = "USER";
    targetUserRole = "STAFF";
  } else if (targetTypeRaw === "CAMPUS") {
    if (!targetCampusId) throw new Error("Campus is required");
    const [campusRow] = await db.select({ id: campuses.id })
      .from(campuses)
      .where(and(eq(campuses.id, targetCampusId), eq(campuses.institutionId, institutionId)))
      .limit(1);
    if (!campusRow) throw new Error("Campus not found");
    targetType = "CAMPUS";
    resolvedCampusId = targetCampusId;
  } else if (targetTypeRaw === "CLASS") {
    if (!targetClassId) throw new Error("Class is required");
    const [classRow] = await db.select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, targetClassId), eq(classes.institutionId, institutionId)))
      .limit(1);
    if (!classRow) throw new Error("Class not found");
    targetType = "CLASS";
    resolvedClassId = targetClassId;
  } else if (targetTypeRaw === "SECTION") {
    if (!targetClassId || !targetSectionId) throw new Error("Class and section are required");
    const [sectionRow] = await db.select({ id: sections.id })
      .from(sections)
      .where(and(
        eq(sections.id, targetSectionId),
        eq(sections.classId, targetClassId),
        eq(sections.institutionId, institutionId)
      ))
      .limit(1);
    if (!sectionRow) throw new Error("Section not found for the selected class");
    targetType = "SECTION";
    resolvedClassId = targetClassId;
    resolvedSectionId = targetSectionId;
  }

  const [inserted] = await db.insert(announcements).values({
    institutionId,
    senderRole: "INSTITUTION",
    senderId: institutionId,
    title,
    content,
    targetType,
    targetCampusId: resolvedCampusId,
    targetClassId: resolvedClassId,
    targetSectionId: resolvedSectionId,
    targetUserRole,
  }).returning({ id: announcements.id });

  const { processAnnouncementNotification } = await import("@/lib/notifications");
  await processAnnouncementNotification(inserted.id);

  revalidatePath("/institution/announcements");
  return { success: true };
}

function parseOptionalId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function deleteAnnouncementAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const announcementId = parseOptionalId(formData.get("announcementId"));
  if (!announcementId) throw new Error("Invalid announcement ID");

  const [announcement] = await db.select({ id: announcements.id })
    .from(announcements)
    .where(and(eq(announcements.id, announcementId), eq(announcements.institutionId, institutionId)))
    .limit(1);
  if (!announcement) throw new Error("Announcement not found");

  await db.delete(notifications)
    .where(and(
      eq(notifications.institutionId, institutionId),
      eq(notifications.referenceId, announcementId),
      inArray(notifications.type, ["ANNOUNCEMENT", "EXAM_TIMETABLE"])
    ));

  await db.delete(announcements)
    .where(and(eq(announcements.id, announcementId), eq(announcements.institutionId, institutionId)));

  revalidatePath("/institution/announcements");
  revalidatePath("/institution/dashboard");
  revalidatePath("/staff/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/student/announcements");
  revalidatePath("/student/dashboard");
  revalidatePath(`/announcements/${announcementId}`);
  return { success: true };
}

export async function createClassAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const levelRaw = formData.get("level") as string;
  const level = levelRaw ? parseInt(levelRaw, 10) : 0;

  const [newClass] = await db.insert(classes).values({
    institutionId,
    name,
    level,
  }).returning({ id: classes.id });

  // Auto-create default section so sections can be treated as optional
  await db.insert(sections).values({
    institutionId,
    classId: newClass.id,
    name: "Whole Class",
  });

  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createSectionAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const classId = parseInt(formData.get("classId") as string, 10);
  const classTeacherIdRaw = formData.get("classTeacherId") as string;
  const classTeacherId = classTeacherIdRaw ? parseInt(classTeacherIdRaw, 10) : null;

  if (!name.trim() || !Number.isInteger(classId)) throw new Error("Valid class and section name are required");
  if (classTeacherIdRaw && !Number.isInteger(classTeacherId)) throw new Error("Invalid staff ID");

  const [classRow] = await db.select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId)))
    .limit(1);
  if (!classRow) throw new Error("Class not found");

  if (classTeacherId !== null) {
    const [staffRow] = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId)))
      .limit(1);
    if (!staffRow) throw new Error("Selected staff member was not found in this institution");
  }

  await db.insert(sections).values({
    institutionId,
    name,
    classId,
    classTeacherId,
  });

  revalidatePath("/institution/academics");
  return { success: true };
}

export async function updateClassInchargeAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const sectionIdRaw = formData.get("sectionId") as string;
  const classIdRaw = formData.get("classId") as string;
  let sectionId = sectionIdRaw ? parseInt(sectionIdRaw, 10) : null;
  const classId = classIdRaw ? parseInt(classIdRaw, 10) : null;
  const classTeacherIdRaw = formData.get("classTeacherId") as string;
  const classTeacherId = classTeacherIdRaw ? parseInt(classTeacherIdRaw, 10) : null;

  if (sectionIdRaw && !Number.isInteger(sectionId)) throw new Error("Invalid section ID");
  if (!sectionId && (!classId || !Number.isInteger(classId))) throw new Error("Valid section or class is required");
  if (classTeacherIdRaw && !Number.isInteger(classTeacherId)) throw new Error("Invalid staff ID");

  if (!sectionId && classId) {
    sectionId = await getOrCreateWholeClassSection(institutionId, classId);
  }

  const [sectionRow] = await db.select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.id, sectionId!), eq(sections.institutionId, institutionId)))
    .limit(1);
  if (!sectionRow) throw new Error("Section not found");

  if (classTeacherId !== null) {
    const [staffRow] = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId)))
      .limit(1);
    if (!staffRow) throw new Error("Selected staff member was not found in this institution");
  }

  await db.update(sections)
    .set({ classTeacherId })
    .where(eq(sections.id, sectionId!));

  revalidatePath("/institution/timetable");
  revalidatePath("/staff/attendance");
  return { success: true };
}

export async function createTimetableAssignmentAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");

  const institutionId = session.userId;
  const sectionIdRaw = formData.get("sectionId") as string;
  const classIdRaw = formData.get("classId") as string;
  let sectionId = sectionIdRaw ? parseInt(sectionIdRaw, 10) : null;
  const classId = classIdRaw ? parseInt(classIdRaw, 10) : null;
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string, 10);
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  
  const isBreakRaw = formData.get("isBreak");
  const isBreak = isBreakRaw === "on" || isBreakRaw === "true";
  
  const staffIdRaw = formData.get("staffId");
  const subjectIdRaw = formData.get("subjectId");
  const staffId = staffIdRaw && !isBreak ? parseInt(staffIdRaw as string, 10) : null;
  const subjectId = subjectIdRaw && !isBreak ? parseInt(subjectIdRaw as string, 10) : null;

  if (sectionIdRaw && !Number.isInteger(sectionId)) throw new Error("Invalid section ID");
  if (!sectionId && (!classId || !Number.isInteger(classId))) throw new Error("Valid section or class is required");
  if (!Number.isInteger(dayOfWeek) || !startTime || !endTime || startTime >= endTime) {
    throw new Error("Valid section, day, start time, and end time are required");
  }
  if (!isBreak && (!staffId || !subjectId || !Number.isInteger(staffId) || !Number.isInteger(subjectId))) {
    throw new Error("Subject and teacher are required for class periods");
  }

  if (!sectionId && classId) {
    sectionId = await getOrCreateWholeClassSection(institutionId, classId);
  }

  const [sectionRow] = await db.select()
    .from(sections)
    .where(and(eq(sections.id, sectionId!), eq(sections.institutionId, institutionId)))
    .limit(1);
  if (!sectionRow) throw new Error("Section not found");

  if (subjectId) {
    const [subjectRow] = await db.select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.institutionId, institutionId)))
      .limit(1);
    if (!subjectRow) throw new Error("Subject not found");
  }

  if (staffId) {
    const [staffRow] = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.institutionId, institutionId)))
      .limit(1);
    if (!staffRow) throw new Error("Selected staff member was not found in this institution");
  }

  const sectionConflicts = await db.select()
    .from(staffAssignments)
    .where(and(
      eq(staffAssignments.institutionId, institutionId),
      eq(staffAssignments.sectionId, sectionId!),
      eq(staffAssignments.dayOfWeek, dayOfWeek),
      lt(staffAssignments.startTime, endTime),
      gt(staffAssignments.endTime, startTime)
    ))
    .limit(1);
  if (sectionConflicts.length > 0) throw new Error("This section already has a timetable entry in that time range");

  if (staffId) {
    const staffConflicts = await db.select()
      .from(staffAssignments)
      .where(and(
        eq(staffAssignments.institutionId, institutionId),
        eq(staffAssignments.staffId, staffId),
        eq(staffAssignments.dayOfWeek, dayOfWeek),
        lt(staffAssignments.startTime, endTime),
        gt(staffAssignments.endTime, startTime)
      ))
      .limit(1);
    if (staffConflicts.length > 0) throw new Error("This staff member is already booked in that time range");
  }

  await db.insert(staffAssignments).values({
    institutionId,
    staffId,
    sectionId: sectionId!,
    subjectId,
    isBreak,
    dayOfWeek,
    startTime,
    endTime,
  });

  revalidatePath("/institution/timetable");
  return { success: true };
}

export async function updateFeeVoucherSettingsAction(acceptFeeVouchers: boolean) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  
  await db.update(institutions)
    .set({ acceptFeeVouchers })
    .where(eq(institutions.id, institutionId));
    
  revalidatePath("/institution/settings");
  return { success: true };
}

import { institutionOwners, institutionAdmins } from "@/db/schema";

export async function createInstitutionOwnerAction(formData: FormData) {
  const session = await getSession();
  // Only the actual institution (owner) can fill this out, not the admin.
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const gender = formData.get("gender") as 'MALE' | 'FEMALE' | 'OTHER';
  const email = formData.get("email") as string;
  const contactNumber = formData.get("contactNumber") as string;

  if (!name || !gender || !email || !contactNumber) {
    throw new Error("All fields are required");
  }

  // Check if owner already exists
  const existing = await db.select().from(institutionOwners).where(eq(institutionOwners.institutionId, institutionId)).limit(1);
  if (existing.length > 0) {
    throw new Error("Owner details have already been submitted");
  }

  await db.insert(institutionOwners).values({
    institutionId,
    name,
    gender,
    email,
    contactNumber,
  });

  revalidatePath("/institution");
  return { success: true };
}

export async function createInstitutionAdminAction(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
  const institutionId = session.userId;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) throw new Error("All fields are required");

  const [existing] = await db.select({ value: count() }).from(institutionAdmins).where(eq(institutionAdmins.institutionId, institutionId));
  if (existing.value >= 2) {
    throw new Error("You can only create a maximum of 2 admins");
  }

  const passwordHash = await hash(password);

  await db.insert(institutionAdmins).values({
    institutionId,
    name,
    email,
    passwordHash,
  });

  revalidatePath("/institution/admins");
  return { success: true };
}

export async function deleteInstitutionAdminAction(adminId: number) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new Error("Unauthorized");
  
  const institutionId = session.userId;

  await db.delete(institutionAdmins)
    .where(and(eq(institutionAdmins.id, adminId), eq(institutionAdmins.institutionId, institutionId)));

  revalidatePath("/institution/admins");
  return { success: true };
}
