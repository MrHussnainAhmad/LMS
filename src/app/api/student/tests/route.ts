import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { classes, onlineTestSubmissions, onlineTests, students, subjects, tests } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { and, desc, eq } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [student] = await db.select().from(students)
    .where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId)))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const rows = await db.select({
    onlineTest: onlineTests,
    test: tests,
    className: classes.name,
    subjectName: subjects.name,
  })
    .from(onlineTests)
    .innerJoin(tests, eq(onlineTests.testId, tests.id))
    .innerJoin(classes, eq(tests.classId, classes.id))
    .leftJoin(subjects, eq(tests.subjectId, subjects.id))
    .where(and(
      eq(onlineTests.institutionId, session.institutionId),
      eq(tests.classId, student.classId),
      eq(tests.sectionId, student.sectionId)
    ))
    .orderBy(desc(onlineTests.createdAt));

  const submissions = await db.select().from(onlineTestSubmissions)
    .where(and(
      eq(onlineTestSubmissions.studentId, session.userId),
      eq(onlineTestSubmissions.institutionId, session.institutionId)
    ));

  const submissionByTest = new Map(submissions.map((submission) => [submission.onlineTestId, submission]));
  const nowMs = new Date().getTime();

  const activeRows = rows.map(({ onlineTest, test, subjectName, className }) => {
    const submission = submissionByTest.get(onlineTest.id);
    const isActive = onlineTest.createdAt.getTime() + onlineTest.durationMinutes * 60 * 1000 > nowMs;
    return {
      onlineTest,
      test,
      subjectName,
      className,
      submission,
      isActive,
    };
  });

  return NextResponse.json(activeRows);
});
