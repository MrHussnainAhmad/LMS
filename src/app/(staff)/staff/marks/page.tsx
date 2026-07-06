import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/db";
import { classes, marks, sections, staffAssignments, students, subjects, tests } from "@/db/schema";
import { createStaffAssessmentAction, enterMarksManuallyAction, uploadMarksCsvAction } from "@/app/actions/assessment-actions";
import { getSession } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { ClipboardList, FileEdit, PenLine, Upload } from "lucide-react";
import { redirect } from "next/navigation";

export default async function StaffMarksPage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) redirect("/login");

  const assignedSlots = await db.select({
    sectionId: sections.id,
    sectionName: sections.name,
    classId: classes.id,
    className: classes.name,
    subjectId: subjects.id,
    subjectName: subjects.name,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
    .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

  const sectionOptions = Array.from(new Map(assignedSlots.map((slot) => [slot.sectionId, slot])).values());
  const subjectOptions = Array.from(
    new Map(
      assignedSlots
        .filter((slot) => slot.subjectId && slot.subjectName)
        .map((slot) => [slot.subjectId, { id: slot.subjectId as number, name: slot.subjectName as string }])
    ).values()
  );

  const classIds = new Set(assignedSlots.map((slot) => slot.classId));
  const subjectIds = new Set(assignedSlots.map((slot) => slot.subjectId).filter((id): id is number => Boolean(id)));

  const allInstitutionTests = await db.select({
    test: tests,
    subjectName: subjects.name,
    className: classes.name,
    sectionName: sections.name,
  })
    .from(tests)
    .innerJoin(classes, eq(tests.classId, classes.id))
    .leftJoin(sections, eq(tests.sectionId, sections.id))
    .leftJoin(subjects, eq(tests.subjectId, subjects.id))
    .where(eq(tests.institutionId, session.institutionId));

  const eligibleTests = allInstitutionTests.filter(({ test }) => {
    if (test.createdByRole === "STAFF") return test.staffId === session.userId;
    return classIds.has(test.classId) && subjectIds.has(test.subjectId);
  });

  const markRows = await db.select().from(marks).where(eq(marks.institutionId, session.institutionId));
  const marksByTest = new Map<number, number>();
  const marksByTestAndStudent = new Map<string, number>();
  for (const row of markRows) {
    marksByTest.set(row.testId, (marksByTest.get(row.testId) || 0) + 1);
    marksByTestAndStudent.set(`${row.testId}:${row.studentId}`, row.marksObtained);
  }

  const classStudents = await db.select().from(students).where(eq(students.institutionId, session.institutionId));
  const studentsByClass = new Map<number, typeof students.$inferSelect[]>();
  for (const student of classStudents) {
    const existing = studentsByClass.get(student.classId) || [];
    existing.push(student);
    studentsByClass.set(student.classId, existing);
  }

  for (const list of studentsByClass.values()) {
    list.sort((a, b) => a.classRollNumber.localeCompare(b.classRollNumber, undefined, { numeric: true }));
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Marks Entry</h1>
        <p className="text-stone-500 mt-1">Create class assessments and upload marks in bulk by roll number.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-brand-600" />
              Daily / Weekly / Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form action={createStaffAssessmentAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Class / Section</label>
                <select name="sectionId" required className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="">Select class...</option>
                  {sectionOptions.map((slot) => (
                    <option key={slot.sectionId} value={slot.sectionId}>{slot.className} - {slot.sectionName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
                <select name="type" required className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
                <input name="title" required placeholder="e.g. Chapter 3 Quiz" className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
                  <input name="date" type="date" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Total</label>
                  <input name="maxMarks" type="number" min="1" step="0.01" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Subject(s)</label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-2">
                  {subjectOptions.map((subject) => (
                    <label key={subject.id} className="flex items-center gap-2 text-sm text-stone-700">
                      <input type="checkbox" name="subjectIds" value={subject.id} className="rounded border-stone-300" />
                      {subject.name}
                    </label>
                  ))}
                </div>
              </div>

              <SubmitButton className="w-full">Create Assessment</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-600" />
              Assessments Ready For Marks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {eligibleTests.length === 0 ? (
              <p className="p-6 text-sm text-stone-500">No assessments are available for your assigned classes yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {eligibleTests.map(({ test, className, sectionName, subjectName }) => {
                  const studentsForTest = studentsByClass.get(test.classId) || [];
                  return (
                  <div key={test.id} className="p-5 grid gap-4 xl:grid-cols-[1fr_360px] xl:items-center">
                    <div>
                      <h3 className="font-semibold text-brand-950">{test.title}</h3>
                      <p className="text-sm text-stone-500">
                        {test.type} - {className}{sectionName ? ` - ${sectionName}` : ""} - {subjectName || "Subject"}
                      </p>
                      <p className="text-xs text-stone-500">
                        {new Date(test.date).toLocaleDateString()} - {test.maxMarks} marks - {marksByTest.get(test.id) || 0} uploaded
                      </p>
                    </div>

                    <div className="space-y-4 xl:col-span-2">
                      <details className="rounded-md border border-border bg-surface">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-900 flex items-center gap-2">
                          <PenLine className="h-4 w-4" />
                          Write marks student by student
                        </summary>
                        <form action={enterMarksManuallyAction} className="border-t border-border p-4 space-y-4">
                          <input type="hidden" name="testId" value={test.id} />
                          <input type="hidden" name="totalMarks" value={test.maxMarks} />
                          {studentsForTest.length === 0 ? (
                            <p className="text-sm text-stone-500">No students found for this class.</p>
                          ) : (
                            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
                              <div className="grid grid-cols-[110px_1fr_130px] gap-3 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600">
                                <span>Roll No.</span>
                                <span>Student</span>
                                <span>Marks</span>
                              </div>
                              {studentsForTest.map((student) => (
                                <div key={student.id} className="grid grid-cols-[110px_1fr_130px] gap-3 items-center border-t border-border px-3 py-2">
                                  <input type="hidden" name="rollNumber" value={student.classRollNumber} />
                                  <span className="text-sm font-medium text-brand-900">{student.classRollNumber}</span>
                                  <span className="text-sm text-stone-700 truncate">{student.name}</span>
                                  <input
                                    name="marksObtained"
                                    type="number"
                                    min="0"
                                    max={test.maxMarks}
                                    step="0.01"
                                    required
                                    defaultValue={marksByTestAndStudent.get(`${test.id}:${student.id}`) ?? ""}
                                    className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <SubmitButton>
                            <PenLine className="h-4 w-4 mr-2" />
                            Save Manual Marks
                          </SubmitButton>
                        </form>
                      </details>

                      <form action={uploadMarksCsvAction} className="flex flex-col sm:flex-row gap-2 rounded-md border border-border bg-stone-50 p-3">
                        <input type="hidden" name="testId" value={test.id} />
                        <input
                          type="file"
                          name="csv"
                          accept=".csv,text/csv"
                          required
                          className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
                        />
                        <SubmitButton className="shrink-0">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload CSV
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-stone-600">
          CSV format: column 1 rollnumber, column 2 obtained marks, column 3 total marks. The upload is saved only if every roll number belongs to the selected class and every total matches the assessment total.
        </CardContent>
      </Card>
    </div>
  );
}
