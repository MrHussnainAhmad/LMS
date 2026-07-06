import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { updateStudentProfileSchema } from "@/lib/validators/student";
import { and, eq } from "drizzle-orm";

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
