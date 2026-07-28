import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campuses, classes, sections, studentPromotions, students } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { invalidateUserValidity } from "@/lib/user";
import { invalidateInstitutionRosterCaches } from "@/lib/redis";

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (_req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const studentId = parseInt(id);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [student] = await db.select({
    id: students.id,
    name: students.name,
    fatherName: students.fatherName,
    gender: students.gender,
    loginRollNumber: students.loginRollNumber,
    classRollNumber: students.classRollNumber,
    profilePictureUrl: students.profilePictureUrl,
    emergencyContact: students.emergencyContact,
    parentalWhatsapp: students.parentalWhatsapp,
    yearOfJoining: students.yearOfJoining,
    phone: students.phone,
    age: students.age,
    campusId: students.campusId,
    campusName: campuses.name,
    className: classes.name,
    sectionName: sections.name,
  })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(sections, eq(students.sectionId, sections.id))
    .leftJoin(campuses, eq(students.campusId, campuses.id))
    .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const promotionHistory = await db.select({
    id: studentPromotions.id,
    fromClassId: studentPromotions.fromClassId,
    toClassId: studentPromotions.toClassId,
    status: studentPromotions.status,
    fromRollNumber: studentPromotions.fromRollNumber,
    toRollNumber: studentPromotions.toRollNumber,
    createdAt: studentPromotions.createdAt,
  })
    .from(studentPromotions)
    .where(and(eq(studentPromotions.studentId, studentId), eq(studentPromotions.institutionId, tenantId)))
    .orderBy(desc(studentPromotions.createdAt));

  const historyClassIds = [...new Set(
    promotionHistory.flatMap((row) => [row.fromClassId, row.toClassId].filter((value): value is number => value !== null))
  )];
  const historyClasses = historyClassIds.length
    ? await db.select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(and(eq(classes.institutionId, tenantId), inArray(classes.id, historyClassIds)))
    : [];
  const historyClassNames = new Map(historyClasses.map((row) => [row.id, row.name]));

  return NextResponse.json({
    student: {
      ...student,
      promotionHistory: promotionHistory.map((row) => ({
        ...row,
        fromClassName: historyClassNames.get(row.fromClassId) || "Previous class",
        toClassName: row.status === "GRADUATED" ? "Graduated" : historyClassNames.get(row.toClassId || 0) || "Current class",
        createdAt: row.createdAt.toISOString(),
      })),
    },
  });
});

export const PATCH = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const studentId = parseInt(id);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();

  try {
    const classId = parseInt(body.classId);
    const sectionId = parseInt(body.sectionId);
    if (!Number.isInteger(classId) || !Number.isInteger(sectionId)) {
      return NextResponse.json({ error: "Valid class and section are required" }, { status: 400 });
    }

    const [student] = await db.select({
      id: students.id,
      institutionId: students.institutionId,
      yearOfJoining: students.yearOfJoining,
      gender: students.gender,
      classRollNumber: students.classRollNumber,
    })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
      .limit(1);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const classRollNumber = String(body.classRollNumber || student.classRollNumber).trim();
    if (!classRollNumber) {
      return NextResponse.json({ error: "Class roll number is required" }, { status: 400 });
    }

    const [classRow] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, tenantId))).limit(1);
    const [sectionRow] = await db.select().from(sections).where(and(eq(sections.id, sectionId), eq(sections.institutionId, tenantId))).limit(1);
    if (!classRow || !sectionRow || sectionRow.classId !== classId) {
      return NextResponse.json({ error: "Class or section not found" }, { status: 400 });
    }

    const [updated] = await db.update(students)
      .set({
        name: body.name,
        classId,
        sectionId,
        classRollNumber,
        phone: body.phone || null
      })
      .where(eq(students.id, student.id))
      .returning({ id: students.id });

    if (!updated) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Student updated successfully" });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Login roll number or class roll number already exists" }, { status: 409 });
    }
    console.error("Error updating student:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

export const DELETE = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const studentId = parseInt(id);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [deleted] = await db.delete(students)
      .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
      .returning({ id: students.id });

    if (!deleted) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await invalidateUserValidity("STUDENT", deleted.id);
    await invalidateInstitutionRosterCaches(tenantId);

    return NextResponse.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
