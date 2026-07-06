import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, sections } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const studentAttendance = await db
      .select({
        id: attendances.id,
        date: attendances.date,
        status: attendances.status,
        sectionName: sections.name,
      })
      .from(attendances)
      .innerJoin(sections, eq(attendances.sectionId, sections.id))
      .where(
        and(
          eq(attendances.studentId, session.userId),
          eq(attendances.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(attendances.date));

    return NextResponse.json({ attendance: studentAttendance });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
});
