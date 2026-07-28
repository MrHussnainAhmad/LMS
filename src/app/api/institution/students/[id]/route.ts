import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { classes, sections, students } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
    gender: students.gender,
    loginRollNumber: students.loginRollNumber,
    classRollNumber: students.classRollNumber,
    profilePictureUrl: students.profilePictureUrl,
    emergencyContact: students.emergencyContact,
    parentalWhatsapp: students.parentalWhatsapp,
    yearOfJoining: students.yearOfJoining,
    phone: students.phone,
    age: students.age,
    className: classes.name,
    sectionName: sections.name,
  })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(sections, eq(students.sectionId, sections.id))
    .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
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
