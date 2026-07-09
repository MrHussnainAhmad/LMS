"use server";

import { db } from "@/db";
import { superAdmins, employees, institutions } from "@/db/schema";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createSuperAdminAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN" || !session.isSuperAdmin) {
    throw new Error("Unauthorized: Only the Root Super Admin can create other admins");
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const securityQuestion = formData.get("securityQuestion") as string;
  const securityAnswer = formData.get("securityAnswer") as string;

  if (!email || !password || !securityQuestion || !securityAnswer) {
    throw new Error("All fields are required");
  }

  const existingAdmin = await db.select().from(superAdmins).where(eq(superAdmins.email, email));
  if (existingAdmin.length > 0) {
    throw new Error("A Super Admin with this email already exists");
  }

  const passwordHash = await hash(password);
  const securityAnswerHash = await hash(securityAnswer.toLowerCase().trim());

  await db.insert(superAdmins).values({
    email,
    passwordHash,
    securityQuestion,
    securityAnswerHash,
  });

  revalidatePath("/sa/admins");
  return { success: true };
}

export async function deleteSuperAdminAction(adminId: number) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN" || !session.isSuperAdmin) {
    throw new Error("Unauthorized: Only the Root Super Admin can delete admins");
  }

  if (session.userId === adminId) {
    throw new Error("You cannot delete yourself");
  }

  // Ensure we don't delete the last super admin or root admin (id = 1)
  if (adminId === 1) {
    throw new Error("Cannot delete the primary root super admin");
  }

  await db.delete(superAdmins).where(eq(superAdmins.id, adminId));
  revalidatePath("/sa/admins");
  return { success: true };
}

export async function createEmployeeAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    throw new Error("All fields are required");
  }

  const existingEmployee = await db.select().from(employees).where(eq(employees.email, email));
  if (existingEmployee.length > 0) {
    throw new Error("An employee with this email already exists");
  }

  const passwordHash = await hash(password);

  await db.insert(employees).values({
    name,
    email,
    passwordHash,
    mustChangePassword: true,
  });

  revalidatePath("/sa/employees");
  return { success: true };
}

export async function toggleEmployeeStatusAction(employeeId: number, currentlyDisabled: boolean) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  await db.update(employees)
    .set({ deletedAt: currentlyDisabled ? null : new Date() })
    .where(eq(employees.id, employeeId));

  revalidatePath("/sa/employees");
  return { success: true };
}

export async function deleteEmployeeAction(employeeId: number) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN" || !session.isSuperAdmin) {
    throw new Error("Unauthorized: Only the Root Super Admin can completely delete employees");
  }

  await db.delete(employees).where(eq(employees.id, employeeId));
  revalidatePath("/sa/employees");
  return { success: true };
}

export async function updateInstitutionStatusAction(institutionId: number, newStatus: "PENDING" | "APPROVED" | "REJECTED") {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "EMPLOYEE")) {
    throw new Error("Unauthorized");
  }

  await db.update(institutions)
    .set({ status: newStatus })
    .where(eq(institutions.id, institutionId));

  revalidatePath("/sa/institutions");
  revalidatePath("/sa/dashboard");
  revalidatePath("/employee/institutions");
  revalidatePath("/employee/dashboard");
  return { success: true };
}
