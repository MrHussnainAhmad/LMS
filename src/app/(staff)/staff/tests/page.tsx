import { ClipboardCheck, FileQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { OnlineTestBuilder } from "@/components/tests/OnlineTestBuilder";
import { gradeMixedTestAction } from "@/app/actions/online-test-actions";
import { db } from "@/db";
import { classes, onlineTestQuestions, onlineTestSubmissions, onlineTests, sections, staffAssignments, students, subjects, tests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

type AnswerMap = Record<string, string | number>;

export default async function StaffTestsPage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) redirect("/login");

  const assignedSlots = await db.select({
    sectionId: sections.id,
    sectionName: sections.name,
    className: classes.name,
    subjectId: subjects.id,
    subjectName: subjects.name,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .innerJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
    .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

  const sectionOptions = Array.from(new Map(assignedSlots.map((slot) => [slot.sectionId, {
    id: slot.sectionId,
    className: slot.className,
    sectionName: slot.sectionName,
  }])).values());
  const subjectOptions = assignedSlots.map((slot) => ({
    id: slot.subjectId,
    name: slot.subjectName,
    sectionId: slot.sectionId,
  }));

  const hostedTests = await db.select({
    onlineTest: onlineTests,
    test: tests,
    className: classes.name,
    sectionName: sections.name,
    subjectName: subjects.name,
  })
    .from(onlineTests)
    .innerJoin(tests, eq(onlineTests.testId, tests.id))
    .innerJoin(classes, eq(tests.classId, classes.id))
    .leftJoin(sections, eq(tests.sectionId, sections.id))
    .leftJoin(subjects, eq(tests.subjectId, subjects.id))
    .where(and(eq(tests.staffId, session.userId), eq(tests.institutionId, session.institutionId)))
    .orderBy(desc(onlineTests.createdAt));

  const submissionRows = await db.select({
    submission: onlineTestSubmissions,
    onlineTest: onlineTests,
    test: tests,
    studentName: students.name,
    rollNumber: students.classRollNumber,
  })
    .from(onlineTestSubmissions)
    .innerJoin(onlineTests, eq(onlineTestSubmissions.onlineTestId, onlineTests.id))
    .innerJoin(tests, eq(onlineTests.testId, tests.id))
    .innerJoin(students, eq(onlineTestSubmissions.studentId, students.id))
    .where(and(eq(tests.staffId, session.userId), eq(tests.institutionId, session.institutionId)))
    .orderBy(desc(onlineTestSubmissions.submittedAt));

  const hostedOnlineTestIds = hostedTests.map((row) => row.onlineTest.id);
  const questions = hostedOnlineTestIds.length > 0
    ? await db.select().from(onlineTestQuestions).where(inArray(onlineTestQuestions.onlineTestId, hostedOnlineTestIds))
    : [];
  const questionsByTest = new Map<number, typeof questions>();
  for (const question of questions) {
    const list = questionsByTest.get(question.onlineTestId) || [];
    list.push(question);
    questionsByTest.set(question.onlineTestId, list);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Teacher hosted tests</p>
        <h1 className="mt-2 text-3xl font-display font-bold text-brand-950">Host Test</h1>
        <p className="mt-1 text-stone-500">Create MCQ-only or Mix tests for your assigned classes and subjects.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[520px_1fr]">
        <Card className="h-fit">
          <CardHeader className="border-b border-border bg-stone-50/70">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileQuestion className="h-5 w-5 text-brand-700" />
              New Test
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {sectionOptions.length === 0 ? (
              <p className="text-sm text-stone-500">No classes are assigned to your account yet.</p>
            ) : (
              <OnlineTestBuilder sections={sectionOptions} subjects={subjectOptions} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/70">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-brand-700" />
                Hosted Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {hostedTests.length === 0 ? (
                <p className="p-6 text-sm text-stone-500">No online tests hosted yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {hostedTests.map(({ onlineTest, test, className, sectionName, subjectName }) => {
                    const relatedSubmissions = submissionRows.filter((row) => row.onlineTest.id === onlineTest.id);
                    const testQuestions = (questionsByTest.get(onlineTest.id) || []).sort((a, b) => a.orderIndex - b.orderIndex);
                    const shortQuestions = testQuestions.filter((question) => question.questionType === "SHORT");
                    return (
                      <details key={onlineTest.id} className="group">
                        <summary className="flex cursor-pointer flex-col gap-3 p-5 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-brand-950">{test.title}</h3>
                            <p className="text-sm text-stone-500">{onlineTest.mode} - {className} - {sectionName || "Section"} - {subjectName || "Subject"}</p>
                            <p className="text-xs text-stone-500">{onlineTest.durationMinutes} min - {test.maxMarks} marks - {relatedSubmissions.length} submissions</p>
                          </div>
                          <span className="w-fit rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-brand-700 group-open:bg-brand-50">
                            Review submissions
                          </span>
                        </summary>

                        <div className="border-t border-border bg-stone-50/50 p-5">
                          {relatedSubmissions.length === 0 ? (
                            <p className="rounded-md border border-dashed border-border bg-white p-4 text-sm text-stone-500">
                              No student has submitted this test yet. Submissions will appear here automatically.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {relatedSubmissions.map(({ submission, studentName, rollNumber }) => {
                                const answers = submission.answers as AnswerMap;
                                return (
                                  <details key={submission.id} className="rounded-md border border-border bg-white">
                                    <summary className="flex cursor-pointer flex-col gap-2 p-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <h4 className="font-semibold text-brand-950">{studentName} <span className="text-sm text-stone-500">({rollNumber})</span></h4>
                                        <p className="text-sm text-stone-500">
                                          {submission.status}
                                          {submission.violationReason ? ` - ${submission.violationReason.replace("_", " ")}` : ""}
                                        </p>
                                      </div>
                                      <span className="text-sm font-bold text-brand-900">{submission.totalScore}/{test.maxMarks}</span>
                                    </summary>

                                    <div className="border-t border-border p-4">
                                      <div className="space-y-3">
                                        {testQuestions.map((question) => (
                                          <div key={question.id} className="rounded-md border border-border bg-stone-50 p-3">
                                            <p className="text-sm font-semibold text-brand-950">{question.prompt}</p>
                                            <p className="mt-1 text-sm text-stone-600">Answer: {String(answers[String(question.id)] ?? "Not answered")}</p>
                                            <p className="mt-1 text-xs text-stone-500">{question.marks} marks</p>
                                          </div>
                                        ))}
                                      </div>

                                      {onlineTest.mode === "MIX" && submission.status === "PENDING_REVIEW" && (
                                        <form action={gradeMixedTestAction} className="mt-4 space-y-3 rounded-md border border-border bg-white p-4">
                                          <input type="hidden" name="submissionId" value={submission.id} />
                                          <p className="text-sm font-semibold text-brand-950">Grade short questions</p>
                                          {shortQuestions.map((question) => (
                                            <label key={question.id} className="grid gap-2 text-sm sm:grid-cols-[1fr_140px] sm:items-center">
                                              <span className="text-stone-700">{question.prompt}</span>
                                              <input name={`score-${question.id}`} type="number" min="0" max={question.marks} step="0.5" required placeholder={`/${question.marks}`} className="rounded-md border border-border px-3 py-2" />
                                            </label>
                                          ))}
                                          <SubmitButton>Save Grade</SubmitButton>
                                        </form>
                                      )}
                                    </div>
                                  </details>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
