import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstitutionExamForm } from "@/components/exams/InstitutionExamForm";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteInstitutionExamAction, updateInstitutionExamAction } from "@/app/actions/assessment-actions";
import { db } from "@/db";
import { classes, subjects, tests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CalendarDays, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

function formatExamDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function countSundays(start: string, end: string) {
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let total = 0;

  while (current <= last) {
    if (current.getUTCDay() === 0) total += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return total;
}

export default async function InstitutionExamsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const institutionId = session.userId;
  const [allClasses, allSubjects, examRows] = await Promise.all([
    db.select().from(classes).where(eq(classes.institutionId, institutionId)),
    db.select().from(subjects).where(eq(subjects.institutionId, institutionId)),
    db.select({
      id: tests.id,
      title: tests.title,
      type: tests.type,
      date: tests.date,
      endDate: tests.endDate,
      maxMarks: tests.maxMarks,
      classId: tests.classId,
      subjectId: tests.subjectId,
      className: classes.name,
      subjectName: subjects.name,
    })
      .from(tests)
      .innerJoin(classes, eq(tests.classId, classes.id))
      .innerJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(and(
        eq(tests.institutionId, institutionId),
        eq(tests.createdByRole, "INSTITUTION"),
        inArray(tests.type, ["MONTHLY", "MID", "FINAL"])
      ))
      .orderBy(desc(tests.createdAt)),
  ]);

  const examGroups = Array.from(
    examRows.reduce((groups, exam) => {
      const key = `${exam.title}-${exam.type}-${exam.classId}-${exam.maxMarks}-${exam.endDate || exam.date}`;
      const existing = groups.get(key);
      if (existing) {
        existing.examIds.push(exam.id);
        existing.subjectIds.push(exam.subjectId);
        existing.subjectCount += 1;
        if (exam.date < existing.startDate) existing.startDate = exam.date;
        if ((exam.endDate || exam.date) > existing.endDate) existing.endDate = exam.endDate || exam.date;
      } else {
        groups.set(key, {
          key,
          title: exam.title,
          type: exam.type,
          classId: exam.classId,
          className: exam.className,
          maxMarks: exam.maxMarks,
          examIds: [exam.id],
          subjectIds: [exam.subjectId],
          subjectCount: 1,
          startDate: exam.date,
          endDate: exam.endDate || exam.date,
        });
      }
      return groups;
    }, new Map<string, {
      key: string;
      title: string;
      type: string;
      classId: number;
      className: string;
      maxMarks: number;
      examIds: number[];
      subjectIds: number[];
      subjectCount: number;
      startDate: string;
      endDate: string;
    }>())
      .values()
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Exam Timetable</h1>
        <p className="text-stone-500 mt-1">Create institution exams for classes. Monthly, Mid, and Final exams are scheduled here without questions or MCQs.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="h-fit">
          <CardHeader className="border-b border-border bg-stone-50/70">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-brand-700" />
              Create Institution Exam
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <InstitutionExamForm
              classes={allClasses.map((classRow) => ({ id: classRow.id, name: classRow.name }))}
              subjects={allSubjects.map((subject) => ({ id: subject.id, name: subject.name }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/70">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-brand-700" />
              Scheduled Exams
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {examRows.length === 0 ? (
              <p className="p-8 text-sm text-stone-500">No institution exams scheduled yet.</p>
            ) : (
              <div>
                <div className="grid gap-3 border-b border-border p-5 md:grid-cols-2">
                  {examGroups.map((group) => {
                    const skippedSundays = countSundays(group.startDate, group.endDate);
                    return (
                      <div key={group.key} className="rounded-md border border-brand-100 bg-brand-50/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-brand-950">{group.title}</p>
                            <p className="text-xs text-stone-500">{group.className} - {group.type}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-brand-800">
                            {group.subjectCount} books
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium text-stone-700">
                          Start: {formatExamDate(group.startDate)} | End: {formatExamDate(group.endDate)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Sundays skipped: {skippedSundays}. End date is calculated from the selected books.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <details className="w-full">
                            <summary className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50">
                              <Pencil className="h-3.5 w-3.5" />
                              Update exam
                            </summary>
                            <div className="mt-3 rounded-md border border-border bg-white p-4">
                              <InstitutionExamForm
                                classes={allClasses.map((classRow) => ({ id: classRow.id, name: classRow.name }))}
                                subjects={allSubjects.map((subject) => ({ id: subject.id, name: subject.name }))}
                                action={updateInstitutionExamAction}
                                submitLabel="Update Exam Dates"
                                hiddenFields={{ examIds: group.examIds.join(",") }}
                                initialValues={{
                                  classId: group.classId,
                                  type: group.type as "MONTHLY" | "MID" | "FINAL",
                                  title: group.title,
                                  maxMarks: group.maxMarks,
                                  date: group.startDate,
                                  subjectIds: group.subjectIds,
                                }}
                              />
                            </div>
                          </details>
                          <form action={deleteInstitutionExamAction}>
                            <input type="hidden" name="examIds" value={group.examIds.join(",")} />
                            <SubmitButton variant="outline" className="gap-2 border-danger/30 text-danger hover:bg-danger/10">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete exam
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-stone-50 text-xs uppercase text-stone-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Exam</th>
                        <th className="px-5 py-3 font-medium">Class</th>
                        <th className="px-5 py-3 font-medium">Subject</th>
                        <th className="px-5 py-3 font-medium">Subject Date</th>
                        <th className="px-5 py-3 font-medium">End Date</th>
                        <th className="px-5 py-3 font-medium">Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {examRows.map((exam) => (
                        <tr key={exam.id} className="hover:bg-stone-50/60">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-brand-950">{exam.title}</p>
                            <p className="text-xs text-stone-500">{exam.type}</p>
                          </td>
                          <td className="px-5 py-4 text-stone-700">{exam.className}</td>
                          <td className="px-5 py-4 text-stone-700">{exam.subjectName}</td>
                          <td className="px-5 py-4 text-stone-700">{formatExamDate(exam.date)}</td>
                          <td className="px-5 py-4 text-stone-700">{exam.endDate ? formatExamDate(exam.endDate) : "-"}</td>
                          <td className="px-5 py-4 text-stone-700">{exam.maxMarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
