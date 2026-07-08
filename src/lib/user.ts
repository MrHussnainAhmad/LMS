import { db } from "@/db";
import { students, staff, institutions, employees, superAdmins } from "@/db/schema";
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
