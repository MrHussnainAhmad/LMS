"use server";
import { createTimetableAssignment } from "@/lib/timetable-coverage";

import { ActionInputError } from "@/lib/action-input-error";
import { z } from 'zod';
import { announcementResponsePolicySchema, deleteInstitutionAnnouncement } from '@/lib/announcements';

import { db } from "@/db";
import { campuses, staff, classes, sections, subjects, announcements, institutions } from "@/db/schema";
import { assertSecurityPermission } from "@/lib/security-permissions";
import { getSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { eq, and, count, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { createStaffAccount } from "@/lib/user";
import { getOrCreateWholeClassSection } from "@/lib/student-login-institution";
import { invalidateStudentEnrichCache, invalidateStaffReadCaches } from "@/lib/redis";
import { assertCampusEmailAvailable, createCampusWorkspace } from "@/lib/campus-workspaces";
import { assertCampusWritable } from "@/lib/campus-view";

import { invalidateInstitutionAcademicsCache } from "@/lib/institution-academics-data";

export async function createCampusAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");
  
  const result = await createCampusWorkspace(session, {
    name: formData.get("name"), address: formData.get("address"), loginEmail: formData.get("loginEmail"),
  });
  revalidatePath("/institution/campuses");
  return { success: true, ...result };
}

export async function createStaffAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");
  
  const institutionId = session.institutionId || session.userId;
  const name = formData.get("name") as string;
  const phone = ((formData.get("phone") as string) || "").trim();
  const campusIdRaw = formData.get("campusId") as string;
  const campusId = session.campusId ?? (campusIdRaw ? parseInt(campusIdRaw, 10) : null);
  if (campusIdRaw && Number(campusIdRaw) !== campusId) throw new ActionInputError('Select your own campus.');
  const customRoleId = Number(formData.get("customRoleId"));

  if (!Number.isInteger(customRoleId) || customRoleId <= 0) {
    throw new ActionInputError("Select a staff role before creating the account");
  }
  await createStaffAccount(institutionId, { name, phone, campusId: campusId ?? undefined, customRoleId });

  await invalidateStaffReadCaches(institutionId);
  revalidatePath("/institution/staff");
  return { success: true };
}

export async function createSubjectAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = session.institutionId || session.userId;
  const names = Array.from(new Map(
    String(formData.get("name") || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => [name.toLocaleLowerCase(), name]),
  ).values());
  const code = String(formData.get("code") || "").trim();
  if (names.length === 0) throw new ActionInputError('Subject name is required.');
  if (names.length > 50) throw new ActionInputError('Add no more than 50 subjects at once.');
  if (names.some(name => name.length > 255)) throw new ActionInputError('Subject name must not exceed 255 characters.');
  if (code.length > 50) throw new ActionInputError("Subject code must not exceed 50 characters.");
  if (names.length > 1 && code) throw new ActionInputError("Leave subject code empty when adding multiple subjects");

  const existing = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.institutionId, institutionId));
  const existingNames = new Set(existing.map((subject) => subject.name.trim().toLocaleLowerCase()));
  const newNames = names.filter((name) => !existingNames.has(name.toLocaleLowerCase()));
  if (newNames.length === 0) throw new ActionInputError("All entered subjects already exist");

  await db.insert(subjects).values(newNames.map((name) => ({
    institutionId,
    name,
    code: names.length === 1 ? code || null : null,
  })));

  await invalidateInstitutionAcademicsCache(institutionId);
  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createAnnouncementAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = getTenantContext(session);
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const targetTypeRaw = formData.get("targetType") as string;
  const responsePolicy=announcementResponsePolicySchema.parse({mode:formData.get('responseMode')||'NONE',dueDate:formData.get('responseDeadline')||undefined});
  if(responsePolicy.mode==='CONSENT'&&targetTypeRaw==='STAFF')throw new ActionInputError('Consent notices must include students and their parents.');
  const targetCampusId = parseOptionalId(formData.get("targetCampusId"));
  const targetClassId = parseOptionalId(formData.get("targetClassId"));
  const targetSectionId = parseOptionalId(formData.get("targetSectionId"));

  if (!title.trim() || !content.trim()) throw new ActionInputError("Title and content are required");
  if (!["ALL", "STAFF", "CAMPUS", "CLASS", "SECTION"].includes(targetTypeRaw)) throw new ActionInputError("Invalid target audience");

  let targetType: "ALL" | "CAMPUS" | "CLASS" | "SECTION" | "USER" = "ALL";
  let targetUserRole: "STAFF" | null = null;
  let resolvedCampusId: number | null = null;
  let resolvedClassId: number | null = null;
  let resolvedSectionId: number | null = null;

  if (targetTypeRaw === "STAFF") {
    targetType = "USER";
    targetUserRole = "STAFF";
  } else if (targetTypeRaw === "CAMPUS") {
    if (!targetCampusId) throw new ActionInputError("Campus is required");
    const [campusRow] = await db.select({ id: campuses.id })
      .from(campuses)
      .where(and(eq(campuses.id, targetCampusId), eq(campuses.institutionId, institutionId)))
      .limit(1);
    if (!campusRow) throw new ActionInputError("Campus not found");
    targetType = "CAMPUS";
    resolvedCampusId = targetCampusId;
  } else if (targetTypeRaw === "CLASS") {
    if (!targetClassId) throw new ActionInputError("Class is required");
    const [classRow] = await db.select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, targetClassId), eq(classes.institutionId, institutionId)))
      .limit(1);
    if (!classRow) throw new ActionInputError("Class not found");
    targetType = "CLASS";
    resolvedClassId = targetClassId;
  } else if (targetTypeRaw === "SECTION") {
    if (!targetClassId || !targetSectionId) throw new ActionInputError("Class and section are required");
    const [sectionRow] = await db.select({ id: sections.id })
      .from(sections)
      .where(and(
        eq(sections.id, targetSectionId),
        eq(sections.classId, targetClassId),
        eq(sections.institutionId, institutionId)
      ))
      .limit(1);
    if (!sectionRow) throw new ActionInputError("Section not found for the selected class");
    targetType = "SECTION";
    resolvedClassId = targetClassId;
    resolvedSectionId = targetSectionId;
  }

  const [inserted] = await db.insert(announcements).values({
    institutionId,
    senderRole: session.role,
    senderId: session.userId,
    title,
    content,
    targetType,
    targetCampusId: resolvedCampusId,
    targetClassId: resolvedClassId,
    targetSectionId: resolvedSectionId,
    targetUserRole,
    responsePolicy,
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
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = getTenantContext(session);
  const announcementId = parseOptionalId(formData.get("announcementId"));
  if (!announcementId) throw new ActionInputError("Invalid announcement ID");

  await deleteInstitutionAnnouncement({...session,institutionId},announcementId);
  revalidatePath("/institution/announcements");
  revalidatePath("/staff/announcements");
  revalidatePath("/student/announcements");
  revalidatePath(`/announcements/${announcementId}`);
  return { success: true };
}

export async function createClassAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = getTenantContext(session);
  const name = String(formData.get("name") || '').trim();
  const levelRaw = formData.get("level") as string;
  const level = levelRaw ? Number(levelRaw) : 0;
  z.object({ name: z.string().min(1).max(100), level: z.number().int().min(0).max(100) }).parse({ name, level });
  const isFinalClass = formData.get("isFinalClass") === "on";

  if (isFinalClass) {
    await db.update(classes).set({ isFinalClass: false }).where(eq(classes.institutionId, institutionId));
  }

  const [newClass] = await db.insert(classes).values({
    institutionId,
    name,
    level,
    isFinalClass,
  }).returning({ id: classes.id });

  // Auto-create default section so sections can be treated as optional
  await db.insert(sections).values({
    institutionId,
    classId: newClass.id,
    name: "Whole Class",
  });

  await invalidateInstitutionAcademicsCache(institutionId);
  revalidatePath("/institution/academics");
  return { success: true };
}

export async function createSectionAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = getTenantContext(session);
  const name = formData.get("name") as string;
  const classId = parseInt(formData.get("classId") as string, 10);
  const classTeacherIdRaw = formData.get("classTeacherId") as string;
  const classTeacherId = classTeacherIdRaw ? parseInt(classTeacherIdRaw, 10) : null;

  if (!/^[A-Za-z0-9]$/.test(name.trim()) || !Number.isInteger(classId)) {
    throw new ActionInputError("Section must be exactly one letter or number, for example A, B, C, or 1");
  }
  if (classTeacherIdRaw && !Number.isInteger(classTeacherId)) throw new ActionInputError("Invalid staff ID");

  const [classRow] = await db.select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId)))
    .limit(1);
  if (!classRow) throw new ActionInputError("Class not found");

  if (classTeacherId !== null) {
    const [staffRow] = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId)))
      .limit(1);
    if (!staffRow) throw new ActionInputError("Selected staff member was not found in this institution");
  }

  await db.insert(sections).values({
    institutionId,
    name,
    classId,
    classTeacherId,
  });

  await invalidateInstitutionAcademicsCache(institutionId);
  revalidatePath("/institution/academics");
  return { success: true };
}

export async function updateClassInchargeAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = session.institutionId || session.userId;
  const sectionIdRaw = formData.get("sectionId") as string;
  const classIdRaw = formData.get("classId") as string;
  let sectionId = sectionIdRaw ? parseInt(sectionIdRaw, 10) : null;
  const classId = classIdRaw ? parseInt(classIdRaw, 10) : null;
  const classTeacherIdRaw = formData.get("classTeacherId") as string;
  const classTeacherId = classTeacherIdRaw ? parseInt(classTeacherIdRaw, 10) : null;

  if (sectionIdRaw && !Number.isInteger(sectionId)) throw new ActionInputError("Invalid section ID");
  if (!sectionId && (!classId || !Number.isInteger(classId))) throw new ActionInputError("Valid section or class is required");
  if (classTeacherIdRaw && !Number.isInteger(classTeacherId)) throw new ActionInputError("Invalid staff ID");

  if (!sectionId && classId) {
    sectionId = (await getOrCreateWholeClassSection(institutionId, classId)).id;
  }

  const [sectionRow] = await db.select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.id, sectionId!), eq(sections.institutionId, institutionId)))
    .limit(1);
  if (!sectionRow) throw new ActionInputError("Section not found");

  if (classTeacherId !== null) {
    const [staffRow] = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId)))
      .limit(1);
    if (!staffRow) throw new ActionInputError("Selected staff member was not found in this institution");
  }

  await db.update(sections)
    .set({ classTeacherId })
    .where(eq(sections.id, sectionId!));

  revalidatePath("/institution/timetable");
  revalidatePath("/institution/timetable/overview");
  await invalidateInstitutionAcademicsCache(institutionId);
  revalidatePath("/staff/attendance");
  return { success: true };
}

export async function createTimetableAssignmentAction(formData: FormData) {
  const session = await getSession();
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  await createTimetableAssignment(session,{
    sectionId:formData.get('sectionId')||undefined,classId:formData.get('classId')||undefined,
    dayOfWeek:formData.get('dayOfWeek'),startTime:formData.get('startTime'),endTime:formData.get('endTime'),
    isBreak:['on','true'].includes(String(formData.get('isBreak'))),staffId:formData.get('staffId')||undefined,subjectId:formData.get('subjectId')||undefined,
  });
  revalidatePath("/institution/timetable");
  revalidatePath("/institution/timetable/overview");
  return { success: true };
}

export async function updateGraduatedStudentAccessAction(allowGraduatedStudentAccess: boolean) {
  const session = await getSession();
  await assertSecurityPermission(session, "institution.security");
  assertCampusWritable(session);
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");

  const institutionId = session.institutionId || session.userId;

  await db.update(institutions)
    .set({ allowGraduatedStudentAccess })
    .where(eq(institutions.id, institutionId));

  // Cached session enrichment (lib/auth.ts) carries a copy of this access gate.
  await invalidateStudentEnrichCache(institutionId);

  revalidatePath("/institution/settings");
  return { success: true };
}

import { institutionOwners, institutionAdmins } from "@/db/schema";

export async function createInstitutionOwnerAction(formData: FormData) {
  const session = await getSession();
  await assertSecurityPermission(session, "institution.security");
  assertCampusWritable(session);
  // Only the actual institution (owner) can fill this out, not the admin.
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) throw new ActionInputError("Unauthorized");
  
  const institutionId = getTenantContext(session);
  const name = formData.get("name") as string;
  const gender = formData.get("gender") as 'MALE' | 'FEMALE' | 'OTHER';
  const email = formData.get("email") as string;
  const contactNumber = formData.get("contactNumber") as string;

  if (!name || !gender || !email || !contactNumber) {
    throw new ActionInputError("All fields are required");
  }

  // Check if owner already exists
  const existing = await db.select().from(institutionOwners).where(eq(institutionOwners.institutionId, institutionId)).limit(1);
  if (existing.length > 0) {
    throw new ActionInputError("Owner details have already been submitted");
  }

  await db.insert(institutionOwners).values({
    institutionId,
    name,
    gender,
    email,
    contactNumber,
  });

  try {
    const { redis } = await import("@/lib/redis");
    if (redis.status === "ready") {
      await redis.del(`cache:institution:owner-exists:${institutionId}`);
    }
  } catch {
    // Owner gate falls back to DB within TTL if delete fails
  }

  revalidatePath("/institution");
  return { success: true };
}

export async function createInstitutionAdminAction(formData: FormData) {
  const session = await getSession();
  await assertSecurityPermission(session, "institution.security");
  assertCampusWritable(session);
  if (!session || session.role !== "INSTITUTION") throw new ActionInputError("Unauthorized");
  
  const institutionId = getTenantContext(session);
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) throw new ActionInputError("All fields are required");

  const [existing] = await db.select({ value: count() }).from(institutionAdmins).where(eq(institutionAdmins.institutionId, institutionId));
  if (existing.value >= 2) {
    throw new ActionInputError("You can only create a maximum of 2 admins");
  }

  const passwordHash = await hash(password);

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM institutions WHERE id = ${institutionId} FOR UPDATE`);
    await assertCampusEmailAvailable(tx, email.trim().toLowerCase());
    const [adminCount] = await tx.select({ value: count() }).from(institutionAdmins).where(eq(institutionAdmins.institutionId, institutionId));
    if (adminCount.value >= 2) throw new ActionInputError('You can only create a maximum of 2 admins');
    await tx.insert(institutionAdmins).values({ institutionId, name, email: email.trim().toLowerCase(), passwordHash });
  });

  revalidatePath("/institution/admins");
  return { success: true };
}

export async function deleteInstitutionAdminAction(adminId: number) {
  const session = await getSession();
  await assertSecurityPermission(session, "institution.security");
  assertCampusWritable(session);
  if (!session || session.role !== "INSTITUTION") throw new ActionInputError("Unauthorized");
  
  const institutionId = getTenantContext(session);

  await db.delete(institutionAdmins)
    .where(and(eq(institutionAdmins.id, adminId), eq(institutionAdmins.institutionId, institutionId)));

  revalidatePath("/institution/admins");
  return { success: true };
}
