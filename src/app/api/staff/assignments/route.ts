import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assignments, classes, sections, subjects } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const staffAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        dueAt: assignments.dueAt,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
      })
      .from(assignments)
      .leftJoin(classes, eq(assignments.classId, classes.id))
      .leftJoin(sections, eq(assignments.sectionId, sections.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(
        and(
          eq(assignments.staffId, session.userId),
          eq(assignments.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(assignments.dueAt));

    return NextResponse.json({ assignments: staffAssignments });
  } catch (error) {
    console.error("Error fetching staff assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
});
