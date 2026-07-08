import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marks, tests, subjects, onlineTests } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const studentMarks = await db
      .select({
        id: marks.id,
        testId: marks.testId,
        marksObtained: marks.marksObtained,
        totalMarks: marks.totalMarks,
        testTitle: tests.title,
        testDate: tests.date,
        testType: tests.type,
        subjectName: subjects.name,
        isOnline: onlineTests.id, // Will be non-null if online
        onlineTestId: onlineTests.id,
      })
      .from(marks)
      .innerJoin(tests, eq(marks.testId, tests.id))
      .innerJoin(subjects, eq(tests.subjectId, subjects.id))
      .leftJoin(onlineTests, eq(tests.id, onlineTests.testId))
      .where(
        and(
          eq(marks.studentId, session.userId),
          eq(marks.institutionId, session.institutionId)
        )
      )
      .orderBy(desc(tests.date));

    // Normalize the boolean
    const formattedMarks = studentMarks.map((m) => ({
      ...m,
      isOnline: !!m.isOnline,
    }));

    return NextResponse.json({ marks: formattedMarks });
  } catch (error) {
    console.error("Error fetching marks:", error);
    return NextResponse.json({ error: "Failed to fetch marks" }, { status: 500 });
  }
});
