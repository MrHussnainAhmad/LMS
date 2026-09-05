import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  campuses,
  classes,
  institutions,
  parentAccounts,
  parentStudents,
  sections,
  students,
} from "@/db/schema";
import type { JWTPayload } from "@/lib/auth-types";

export class ParentChildAccessError extends Error {
  constructor() {
    super("The requested student is not linked to this parent account");
  }
}

export async function getParentPortalContext(
  session: JWTPayload,
  requestedStudentId?: string | number | null,
  options: { selectedOnly?: boolean } = {},
) {
  if (session.role !== "PARENT" || !session.institutionId) {
    throw new ParentChildAccessError();
  }

  let requestedId: number | null = null;
  if (requestedStudentId !== undefined && requestedStudentId !== null && String(requestedStudentId) !== "") {
    requestedId = Number(requestedStudentId);
    if (!Number.isInteger(requestedId) || requestedId <= 0) throw new ParentChildAccessError();
  }
  const childFilters = [
    eq(parentStudents.parentId, session.userId),
    eq(parentStudents.institutionId, session.institutionId),
    eq(students.institutionId, session.institutionId),
    isNull(students.deletedAt),
  ];
  if (requestedId !== null && options.selectedOnly) childFilters.push(eq(students.id, requestedId));
  const childQuery = db.select({
    id: students.id, name: students.name, loginRollNumber: students.loginRollNumber,
    profilePictureUrl: students.profilePictureUrl, classId: students.classId, className: classes.name,
    sectionId: students.sectionId, sectionName: sections.name, campusId: students.campusId,
    campusName: campuses.name, academicStatus: students.academicStatus, createdAt: students.createdAt,
  }).from(parentStudents).innerJoin(students, eq(parentStudents.studentId, students.id))
    .innerJoin(classes, eq(students.classId, classes.id)).innerJoin(sections, eq(students.sectionId, sections.id))
    .leftJoin(campuses, eq(students.campusId, campuses.id)).where(and(...childFilters))
    .orderBy(asc(students.name), asc(students.id));

  const [parentRows, children] = await Promise.all([
    db.select({
      id: parentAccounts.id,
      name: parentAccounts.name,
      email: parentAccounts.email,
      institutionName: institutions.name,
      institutionUsername: institutions.username,
    })
      .from(parentAccounts)
      .innerJoin(institutions, eq(parentAccounts.institutionId, institutions.id))
      .where(and(
        eq(parentAccounts.id, session.userId),
        eq(parentAccounts.institutionId, session.institutionId),
      ))
      .limit(1),
    requestedId !== null && options.selectedOnly ? childQuery.limit(1) : childQuery,
  ]);

  const parent = parentRows[0];
  if (!parent) throw new ParentChildAccessError();

  const selectedChild = requestedId === null
    ? children[0] ?? null
    : children.find((child) => child.id === requestedId) ?? null;
  if (requestedId !== null && !selectedChild) throw new ParentChildAccessError();

  return {
    institutionId: session.institutionId,
    parent,
    children,
    selectedChild,
  };
}

export type ParentPortalContext = Awaited<ReturnType<typeof getParentPortalContext>>;
