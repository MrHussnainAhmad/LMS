"use server";

import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateInstitutionStatusAction(institutionId: number, newStatus: "PENDING" | "APPROVED" | "REJECTED") {
  const session = await getSession();
  if (!session || session.role !== "EMPLOYEE") {
    throw new Error("Unauthorized");
  }

  await db.update(institutions)
    .set({ status: newStatus })
    .where(eq(institutions.id, institutionId));

  revalidatePath("/employee/institutions");
  return { success: true };
}

export async function deleteInstitutionAction(institutionId: number) {
  const session = await getSession();
  if (!session || session.role !== "EMPLOYEE") {
    throw new Error("Unauthorized");
  }

  await db.delete(institutions).where(eq(institutions.id, institutionId));

  revalidatePath("/employee/institutions");
  return { success: true };
}
