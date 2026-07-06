import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marks, tests, subjects } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const studentMarks = await db
      .select({
        id: marks.id,
        marksObtained: marks.marksObtained,
        totalMarks: marks.totalMarks,
        testTitle: tests.title,
        testDate: tests.date,
        testType: tests.type,
        subjectName: subjects.name,
      })
      .from(marks)
      .innerJoin(tests, eq(marks.testId, tests.id))
      .innerJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(
        and(
          eq(marks.studentId, session.userId),
          eq(marks.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(tests.date));

    return NextResponse.json({ marks: studentMarks });
  } catch (error) {
    console.error("Error fetching marks:", error);
    return NextResponse.json({ error: "Failed to fetch marks" }, { status: 500 });
  }
});
