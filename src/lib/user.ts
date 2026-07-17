import { db } from "@/db";
import { students, staff, institutions, employees, superAdmins, institutionAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { JWTPayload } from "./auth-types";

export async function getUserCreatedAt(session: JWTPayload): Promise<Date> {
  const defaultDate = new Date(0);
  switch (session.role) {
    case "STUDENT": {
      const [u] = await db.select({ createdAt: students.createdAt }).from(students).where(eq(students.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "STAFF": {
      const [u] = await db.select({ createdAt: staff.createdAt }).from(staff).where(eq(staff.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "INSTITUTION": {
      const [u] = await db.select({ createdAt: institutions.createdAt }).from(institutions).where(eq(institutions.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "INSTITUTION_ADMIN": {
      const [u] = await db.select({ createdAt: institutionAdmins.createdAt }).from(institutionAdmins).where(eq(institutionAdmins.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "EMPLOYEE": {
      const [u] = await db.select({ createdAt: employees.createdAt }).from(employees).where(eq(employees.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "SUPER_ADMIN": {
      const [u] = await db.select({ createdAt: superAdmins.createdAt }).from(superAdmins).where(eq(superAdmins.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    default:
      return defaultDate;
  }
}

import { cache } from 'react';
import type { UserRole } from './auth-types';

export const verifyUserExists = cache(async (role: UserRole, userId: number): Promise<boolean> => {
  switch (role) {
    case 'SUPER_ADMIN': {
      const [u] = await db.select({ id: superAdmins.id }).from(superAdmins).where(eq(superAdmins.id, userId)).limit(1);
      return !!u;
    }
    case 'EMPLOYEE': {
      const [u] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, userId)).limit(1);
      return !!u;
    }
    case 'INSTITUTION': {
      const [u] = await db.select({ status: institutions.status }).from(institutions).where(eq(institutions.id, userId)).limit(1);
      return u?.status === 'APPROVED';
    }
    case 'INSTITUTION_ADMIN': {
      const [u] = await db.select({ id: institutionAdmins.id }).from(institutionAdmins).where(eq(institutionAdmins.id, userId)).limit(1);
      return !!u;
    }
    case 'STAFF': {
      const [u] = await db.select({ isActive: staff.isActive }).from(staff).where(eq(staff.id, userId)).limit(1);
      return !!u?.isActive;
    }
    case 'STUDENT': {
      const [u] = await db.select({ isActive: students.isActive }).from(students).where(eq(students.id, userId)).limit(1);
      return !!u?.isActive;
    }
    default:
      return false;
  }
});
