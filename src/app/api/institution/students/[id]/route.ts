import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

export const PATCH = requireRole(["INSTITUTION"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const studentId = parseInt(id);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();

  try {
    const [updated] = await db.update(students)
      .set({
        name: body.name,
        classId: parseInt(body.classId),
        sectionId: parseInt(body.sectionId),
        phone: body.phone || null
      })
      .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Student updated successfully" });
  } catch (error) {
    console.error("Error updating student:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

export const DELETE = requireRole(["INSTITUTION"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const studentId = parseInt(id);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [deleted] = await db.delete(students)
      .where(and(eq(students.id, studentId), eq(students.institutionId, tenantId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
