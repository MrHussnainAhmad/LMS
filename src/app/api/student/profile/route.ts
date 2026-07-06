import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students, classes, sections, campuses } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { updateStudentProfileSchema } from "@/lib/validators/student";
import { and, eq } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [profile] = await db
      .select({
        id: students.id,
        name: students.name,
        fatherName: students.fatherName,
        phone: students.phone,
        gender: students.gender,
        loginRollNumber: students.loginRollNumber,
        classRollNumber: students.classRollNumber,
        className: classes.name,
        sectionName: sections.name,
        campusName: campuses.name,
      })
      .from(students)
      .leftJoin(classes, eq(students.classId, classes.id))
      .leftJoin(sections, eq(students.sectionId, sections.id))
      .leftJoin(campuses, eq(students.campusId, campuses.id))
      .where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId)));

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
});

export const PATCH = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = updateStudentProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await db.update(students)
    .set({ fatherName: parsed.data.fatherName })
    .where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId)));

  return NextResponse.json({ message: "Profile updated successfully" });
});
