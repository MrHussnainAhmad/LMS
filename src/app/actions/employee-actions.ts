"use server";

import { ActionInputError } from "@/lib/action-input-error";
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { changeInstitutionStatus, removeInstitution } from '@/lib/institution-status';
export async function updateInstitutionStatusAction(id: number, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
  const session = await getSession();
  if (!session) throw new ActionInputError('Unauthorized');
  await changeInstitutionStatus(session, id, status);
  revalidatePath('/employee/institutions'); revalidatePath('/sa/institutions');
  return { success: true };
}
export async function deleteInstitutionAction(id: number, confirmation: string) {
  const session = await getSession();
  if (!session) throw new ActionInputError('Unauthorized');
  await removeInstitution(session, id, confirmation);
  revalidatePath('/sa', 'layout'); revalidatePath('/employee', 'layout');
  return { success: true };
}
