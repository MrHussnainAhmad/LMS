"use server";

import { db } from "@/db";
import {
  academicSessions,
  accountLockouts,
  announcements,
  assignments,
  attendances,
  auditLogs,
  campuses,
  classes,
  institutionHolidays,
  institutions,
  marks,
  onlineTestQuestions,
  onlineTestSubmissions,
  onlineTests,
  refreshTokens,
  sections,
  staff,
  staffAssignments,
  staffProfileChangeRequests,
  staffTeachableSubjects,
  students,
  studentProfileChangeRequests,
  subjects,
  submissions,
  tests,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateInstitutionStatusAction(institutionId: number, newStatus: "PENDING" | "APPROVED" | "REJECTED") {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "EMPLOYEE")) {
    throw new Error("Unauthorized");
  }

  await db.update(institutions)
    .set({ status: newStatus })
    .where(eq(institutions.id, institutionId));

  revalidatePath("/employee/institutions");
  revalidatePath("/employee/dashboard");
  revalidatePath("/sa/institutions");
  revalidatePath("/sa/dashboard");
  return { success: true };
}

export async function deleteInstitutionAction(institutionId: number, confirmationName: string) {
  const session = await getSession();
  if (!session || session.role !== "EMPLOYEE") {
    throw new Error("Unauthorized");
  }

  const [institution] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!institution) throw new Error("Institution not found");
  if (confirmationName.trim() !== institution.name) {
    throw new Error("Type the exact institution name to confirm deletion");
  }

  await db.transaction(async (tx) => {
    const staffRows = await tx.select({ id: staff.id }).from(staff).where(eq(staff.institutionId, institutionId));
    const studentRows = await tx.select({ id: students.id }).from(students).where(eq(students.institutionId, institutionId));
    const testRows = await tx.select({ id: tests.id }).from(tests).where(eq(tests.institutionId, institutionId));
    const onlineRows = testRows.length > 0
      ? await tx.select({ id: onlineTests.id }).from(onlineTests).where(inArray(onlineTests.testId, testRows.map((row) => row.id)))
      : [];
    const staffIds = staffRows.map((row) => row.id);
    const studentIds = studentRows.map((row) => row.id);

    if (onlineRows.length > 0) {
      await tx.delete(onlineTestQuestions).where(inArray(onlineTestQuestions.onlineTestId, onlineRows.map((row) => row.id)));
    }
    await tx.delete(onlineTestSubmissions).where(eq(onlineTestSubmissions.institutionId, institutionId));
    await tx.delete(onlineTests).where(eq(onlineTests.institutionId, institutionId));
    await tx.delete(submissions).where(eq(submissions.institutionId, institutionId));
    await tx.delete(assignments).where(eq(assignments.institutionId, institutionId));
    await tx.delete(marks).where(eq(marks.institutionId, institutionId));
    await tx.delete(tests).where(eq(tests.institutionId, institutionId));
    await tx.delete(attendances).where(eq(attendances.institutionId, institutionId));
    await tx.delete(announcements).where(eq(announcements.institutionId, institutionId));
    await tx.delete(studentProfileChangeRequests).where(eq(studentProfileChangeRequests.institutionId, institutionId));
    await tx.delete(staffProfileChangeRequests).where(eq(staffProfileChangeRequests.institutionId, institutionId));
    await tx.delete(staffAssignments).where(eq(staffAssignments.institutionId, institutionId));
    await tx.delete(staffTeachableSubjects).where(eq(staffTeachableSubjects.institutionId, institutionId));
    await tx.delete(students).where(eq(students.institutionId, institutionId));
    await tx.delete(staff).where(eq(staff.institutionId, institutionId));
    await tx.delete(subjects).where(eq(subjects.institutionId, institutionId));
    await tx.delete(sections).where(eq(sections.institutionId, institutionId));
    await tx.delete(classes).where(eq(classes.institutionId, institutionId));
    await tx.delete(academicSessions).where(eq(academicSessions.institutionId, institutionId));
    await tx.delete(institutionHolidays).where(eq(institutionHolidays.institutionId, institutionId));
    await tx.delete(campuses).where(eq(campuses.institutionId, institutionId));
    await tx.delete(auditLogs).where(eq(auditLogs.institutionId, institutionId));

    await tx.delete(refreshTokens).where(and(eq(refreshTokens.userRole, "INSTITUTION"), eq(refreshTokens.userId, institutionId)));
    await tx.delete(accountLockouts).where(and(eq(accountLockouts.userRole, "INSTITUTION"), eq(accountLockouts.userId, institutionId)));
    if (staffIds.length > 0) {
      await tx.delete(refreshTokens).where(and(eq(refreshTokens.userRole, "STAFF"), inArray(refreshTokens.userId, staffIds)));
      await tx.delete(accountLockouts).where(and(eq(accountLockouts.userRole, "STAFF"), inArray(accountLockouts.userId, staffIds)));
    }
    if (studentIds.length > 0) {
      await tx.delete(refreshTokens).where(and(eq(refreshTokens.userRole, "STUDENT"), inArray(refreshTokens.userId, studentIds)));
      await tx.delete(accountLockouts).where(and(eq(accountLockouts.userRole, "STUDENT"), inArray(accountLockouts.userId, studentIds)));
    }

    await tx.delete(institutions).where(eq(institutions.id, institutionId));
  });

  revalidatePath("/employee/institutions");
  return { success: true };
}
