import Link from "next/link";
import { CheckCircle2, Clock, FileQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { classes, onlineTestSubmissions, onlineTests, students, subjects, tests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function StudentTestsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) redirect("/login");

  const [student] = await db.select().from(students).where(and(eq(students.id, session.userId), eq(students.institutionId, session.institutionId))).limit(1);
  if (!student) redirect("/login");

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
    .where(and(eq(onlineTests.institutionId, session.institutionId), eq(tests.classId, student.classId), eq(tests.sectionId, student.sectionId)))
    .orderBy(desc(onlineTests.createdAt));

  const submissions = await db.select().from(onlineTestSubmissions).where(and(eq(onlineTestSubmissions.studentId, session.userId), eq(onlineTestSubmissions.institutionId, session.institutionId)));
  const submissionByTest = new Map(submissions.map((submission) => [submission.onlineTestId, submission]));
  const nowMs = new Date().getTime();
  const activeRows = rows.filter(({ onlineTest }) => (
    onlineTest.createdAt.getTime() + onlineTest.durationMinutes * 60 * 1000 > nowMs
    && !submissionByTest.has(onlineTest.id)
  ));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Online tests</p>
        <h1 className="mt-2 text-3xl font-display font-bold text-brand-950">My Tests</h1>
        <p className="mt-1 text-stone-500">Start hosted tests from your teachers and submit answers before the timer ends.</p>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/70">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileQuestion className="h-5 w-5 text-brand-700" />
            Available Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeRows.length === 0 ? (
            <p className="p-8 text-sm text-stone-500">No online tests are available for your class right now.</p>
          ) : (
            <div className="divide-y divide-border">
              {activeRows.map(({ onlineTest, test, subjectName }) => {
                const submission = submissionByTest.get(onlineTest.id);
                return (
                  <div key={onlineTest.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <h3 className="font-semibold text-brand-950">{test.title}</h3>
                      <p className="text-sm text-stone-500">{onlineTest.mode} - {subjectName || "Subject"} - {test.maxMarks} marks</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                        <Clock className="h-3.5 w-3.5" />
                        {onlineTest.durationMinutes} minutes
                      </p>
                    </div>
                    {submission ? (
                      <div className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {submission.status} - {submission.totalScore}/{test.maxMarks}
                      </div>
                    ) : (
                      <Link href={`/student/tests/${onlineTest.id}`} className="rounded-md bg-brand-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-800">
                        Start
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
