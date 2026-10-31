import { db } from "@/db";
import { students, staff, institutions, employees, superAdmins, institutionAdmins, parentAccounts, campuses, subjects, institutionCustomRoles, staffTeachableSubjects } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { JWTPayload, UserRole } from "./auth-types";
import { createStaffSchema } from './validators/staff';
import { generateStaffEmail } from './login-identifiers';
import { hashPassword } from '@/lib/argon2-pool';
import { INITIAL_PORTAL_PASSWORD } from './temporary-password';
import { ActionInputError } from './action-input-error';

/** Shared account creation for the institution form and staff API. */
export async function createStaffAccount(institutionId: number, input: unknown) {
  const { name, phone, campusId, customRoleId, subjectIds } = createStaffSchema.parse(input);
  const uniqueSubjectIds = [...new Set(subjectIds)];
  const [[institution], campusRows, roleRows, subjectRows] = await Promise.all([
    db.select({ username: institutions.username }).from(institutions).where(eq(institutions.id, institutionId)).limit(1),
    campusId ? db.select({ id: campuses.id }).from(campuses)
      .where(and(eq(campuses.id, campusId), eq(campuses.institutionId, institutionId))).limit(1) : [],
    customRoleId ? db.select({ id: institutionCustomRoles.id }).from(institutionCustomRoles)
      .where(and(eq(institutionCustomRoles.id, customRoleId), eq(institutionCustomRoles.institutionId, institutionId))).limit(1) : [],
    uniqueSubjectIds.length ? db.select({ id: subjects.id }).from(subjects)
      .where(and(eq(subjects.institutionId, institutionId), inArray(subjects.id, uniqueSubjectIds))) : [],
  ]);
  if (!institution) throw Object.assign(new ActionInputError('Institution not found'), { status: 404 });
  if (campusId && !campusRows.length) throw new ActionInputError('Campus not found');
  if (customRoleId && !roleRows.length) throw new ActionInputError('Custom role not found');
  if (subjectRows.length !== uniqueSubjectIds.length) throw new ActionInputError('One or more subjects were not found');

  const baseEmail = generateStaffEmail({ name, phone, institution });
  const [localPart, domain] = baseEmail.split('@');
  let email = baseEmail;
  let suffix = 0;
  while (true) {
    // tenant-audit: allow-cross-tenant staff — email has a global unique constraint
    const [existing] = await db.select({ id: staff.id }).from(staff).where(eq(staff.email, email)).limit(1);
    if (!existing) break;
    email = `${localPart}${++suffix}@${domain}`;
  }
  const passwordHash = await hashPassword(INITIAL_PORTAL_PASSWORD);
  const [created] = await db.transaction(async tx => {
    const rows = await tx.insert(staff).values({
      institutionId, name, phone, email, campusId: campusId ?? null, customRoleId: customRoleId ?? null,
      passwordHash, mustChangePassword: true, isActive: true,
    }).returning({ id: staff.id });
    if (uniqueSubjectIds.length) {
      await tx.insert(staffTeachableSubjects).values(uniqueSubjectIds.map(subjectId => ({
        institutionId, staffId: rows[0].id, subjectId,
      })));
    }
    return rows;
  });
  return { id: created.id, email, initialPassword: INITIAL_PORTAL_PASSWORD };
}

/**
 * Prefer createdAt embedded in the JWT (set at login/refresh). Falls back to a
 * DB lookup for older tokens that predate the claim.
 */
export async function resolveUserCreatedAt(session: JWTPayload): Promise<Date> {
  if (session.createdAt) {
    const parsed = new Date(session.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return getUserCreatedAt(session);
}

export async function getUserCreatedAt(session: JWTPayload): Promise<Date> {
  const defaultDate = new Date(0);
  switch (session.role) {
    case "STUDENT": {
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: students.createdAt }).from(students).where(and(
        eq(students.id, session.userId),
        eq(students.institutionId, session.institutionId),
      )).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "STAFF": {
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: staff.createdAt }).from(staff).where(and(
        eq(staff.id, session.userId),
        eq(staff.institutionId, session.institutionId),
      )).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "PARENT": {
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: parentAccounts.createdAt }).from(parentAccounts).where(and(
        eq(parentAccounts.id, session.userId),
        eq(parentAccounts.institutionId, session.institutionId),
      )).limit(1);
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

export type FreshStudent = {
  id: number; institutionId: number; academicStatus: 'ACTIVE' | 'GRADUATED';
  graduatedAccessAllowed: boolean; classId: number; sectionId: number; name: string;
};

/** One current snapshot; never an authorization cache. */
export async function getFreshStudent(userId: number, expectedInstitutionId?: number): Promise<FreshStudent | null> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  const result = await db.execute<FreshStudent>(sql`SELECT u.id, u.institution_id AS "institutionId",
    u.academic_status AS "academicStatus", i.allow_graduated_student_access AS "graduatedAccessAllowed",
    u.class_id AS "classId", u.section_id AS "sectionId", u.name
    FROM students u JOIN institutions i ON i.id=u.institution_id
    LEFT JOIN institutions root ON root.id=i.parent_institution_id
    WHERE u.id=${userId} AND (${expectedInstitutionId ?? null}::integer IS NULL OR u.institution_id=${expectedInstitutionId ?? null})
    AND u.is_active=true AND u.deleted_at IS NULL
    AND (u.academic_status <> 'GRADUATED' OR i.allow_graduated_student_access=true)
    AND i.status='APPROVED' AND i.deleted_at IS NULL
    AND (i.parent_institution_id IS NULL OR (root.status='APPROVED' AND root.deleted_at IS NULL AND root.parent_institution_id IS NULL)) LIMIT 1`);
  return result.rows[0] ?? null;
}

/** Authoritative authorization gate: never reuse cached account liveness. */
export async function verifyUserExistsFresh(role: UserRole, userId: number, expectedInstitutionId?: number): Promise<boolean> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;
  if (role === 'STUDENT') return Boolean(await getFreshStudent(userId, expectedInstitutionId));
  if (role === 'SUPER_ADMIN') return (await db.execute(sql`SELECT id FROM super_admins WHERE id=${userId} LIMIT 1`)).rows.length > 0;
  if (role === 'EMPLOYEE') return (await db.execute(sql`SELECT id FROM employees WHERE id=${userId} AND deleted_at IS NULL LIMIT 1`)).rows.length > 0;
  const activeInstitution = sql`i.status='APPROVED' AND i.deleted_at IS NULL AND (i.parent_institution_id IS NULL OR (root.status='APPROVED' AND root.deleted_at IS NULL AND root.parent_institution_id IS NULL))`;
  if (role === 'INSTITUTION') return (await db.execute(sql`SELECT i.id FROM institutions i LEFT JOIN institutions root ON root.id=i.parent_institution_id WHERE i.id=${userId} AND ${activeInstitution} LIMIT 1`)).rows.length > 0;
  const tables = { INSTITUTION_ADMIN: 'institution_admins', STAFF: 'staff', PARENT: 'parent_accounts' } as const;
  if (!(role in tables)) return false;
  const table = tables[role as keyof typeof tables];
  const activeUser = role === 'STAFF' ? sql`u.is_active=true AND u.deleted_at IS NULL`
    : role === 'PARENT' ? sql`u.deleted_at IS NULL AND u.status <> 'DISABLED' AND u.password_hash IS NOT NULL` : sql`true`;
  return (await db.execute(sql`SELECT u.id FROM ${sql.identifier(table)} u JOIN institutions i ON i.id=u.institution_id LEFT JOIN institutions root ON root.id=i.parent_institution_id WHERE u.id=${userId} AND (${expectedInstitutionId ?? null}::integer IS NULL OR u.institution_id=${expectedInstitutionId ?? null}) AND ${activeUser} AND ${activeInstitution} LIMIT 1`)).rows.length > 0;
}
