import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tests, classes, sections, subjects } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hostedTests = await db
      .select({
        id: tests.id,
        title: tests.title,
        type: tests.type,
        maxMarks: tests.maxMarks,
        date: tests.date,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
      })
      .from(tests)
      .leftJoin(classes, eq(tests.classId, classes.id))
      .leftJoin(sections, eq(tests.sectionId, sections.id))
      .leftJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(
        and(
          eq(tests.staffId, session.userId),
          eq(tests.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(tests.date));

    return NextResponse.json({ tests: hostedTests });
  } catch (error) {
    console.error("Error fetching hosted tests:", error);
    return NextResponse.json({ error: "Failed to fetch tests" }, { status: 500 });
  }
});
