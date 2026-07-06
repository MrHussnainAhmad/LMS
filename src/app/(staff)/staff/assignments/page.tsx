import { db } from "@/db";
import { assignments, classes, sections, staffAssignments, students, subjects, submissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ClipboardList, ExternalLink, UploadCloud } from "lucide-react";
import { createStaffAssignmentAction } from "@/app/actions/assessment-actions";

export default async function StaffAssignmentsPage() {
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

  const sectionOptions = Array.from(
    new Map(assignedSlots.map((slot) => [slot.sectionId, slot])).values()
  );

  const subjectOptions = Array.from(
    new Map(
      assignedSlots
        .filter((slot) => slot.subjectId && slot.subjectName)
        .map((slot) => [slot.subjectId, { id: slot.subjectId as number, name: slot.subjectName as string }])
    ).values()
  );

  const createdAssignments = await db.select({
    assignment: assignments,
    className: classes.name,
    sectionName: sections.name,
    subjectName: subjects.name,
  })
    .from(assignments)
    .innerJoin(classes, eq(assignments.classId, classes.id))
    .leftJoin(sections, eq(assignments.sectionId, sections.id))
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .where(and(eq(assignments.staffId, session.userId), eq(assignments.institutionId, session.institutionId)))
    .orderBy(desc(assignments.createdAt));

  const submissionRows = await db.select().from(submissions).where(eq(submissions.institutionId, session.institutionId));
  const submissionsByAssignment = new Map<number, number>();
  for (const row of submissionRows) {
    submissionsByAssignment.set(row.assignmentId, (submissionsByAssignment.get(row.assignmentId) || 0) + 1);
  }

  const studentRows = await db.select().from(students).where(eq(students.institutionId, session.institutionId));

  const detailedSubmissions = await db.select({
    submission: submissions,
    studentName: students.name,
    rollNumber: students.classRollNumber,
    classId: students.classId,
    sectionId: students.sectionId,
  })
    .from(submissions)
    .innerJoin(students, eq(submissions.studentId, students.id))
    .where(eq(submissions.institutionId, session.institutionId));

  const submissionsByAssignmentId = new Map<number, typeof detailedSubmissions>();
  for (const row of detailedSubmissions) {
    const existing = submissionsByAssignmentId.get(row.submission.assignmentId) || [];
    existing.push(row);
    submissionsByAssignmentId.set(row.submission.assignmentId, existing);
  }

  for (const rows of submissionsByAssignmentId.values()) {
    rows.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }

  const studentsByClass = new Map<number, typeof students.$inferSelect[]>();
  for (const student of studentRows) {
    const existing = studentsByClass.get(student.classId) || [];
    existing.push(student);
    studentsByClass.set(student.classId, existing);
  }

  for (const rows of studentsByClass.values()) {
    rows.sort((a, b) => a.classRollNumber.localeCompare(b.classRollNumber, undefined, { numeric: true }));
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Assignments</h1>
        <p className="text-stone-500 mt-1">Create class work before students can upload submissions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-600" />
              New Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form action={createStaffAssignmentAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Class / Section</label>
                <select name="sectionId" required className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="">Select class...</option>
                  {sectionOptions.map((slot) => (
                    <option key={slot.sectionId} value={slot.sectionId}>
                      {slot.className} - {slot.sectionName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
                <select name="subjectId" className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white">
                  <option value="">General assignment</option>
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
                <input name="title" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea name="description" rows={3} className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Due Date</label>
                <input name="dueAt" type="datetime-local" required className="w-full rounded-md border border-border px-3 py-2 text-sm" />
              </div>

              <SubmitButton className="w-full">Create Assignment</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-brand-600" />
              Created Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {createdAssignments.length === 0 ? (
              <p className="p-6 text-sm text-stone-500">No assignments created yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {createdAssignments.map(({ assignment, className, sectionName, subjectName }) => {
                  const submittedRows = submissionsByAssignmentId.get(assignment.id) || [];
                  const submittedStudentIds = new Set(submittedRows.map((row) => row.submission.studentId));
                  const targetStudents = (studentsByClass.get(assignment.classId) || [])
                    .filter((student) => !assignment.sectionId || student.sectionId === assignment.sectionId);
                  const pendingStudents = targetStudents.filter((student) => !submittedStudentIds.has(student.id));
                  const dueLabel = assignment.dueAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  });

                  return (
                    <div key={assignment.id} className="p-5 space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-brand-950">{assignment.title}</h3>
                          <p className="text-sm text-stone-500">
                            {className}{sectionName ? ` - ${sectionName}` : ""}{subjectName ? ` - ${subjectName}` : ""}
                          </p>
                          <p className="text-xs text-stone-500">Due {dueLabel}</p>
                        </div>
                        <span className="text-sm font-medium text-brand-800">
                          {submissionsByAssignment.get(assignment.id) || 0}/{targetStudents.length} submissions
                        </span>
                      </div>

                      <details className="rounded-md border border-border bg-surface">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-900">
                          View submissions and pending students
                        </summary>
                        <div className="border-t border-border p-4 grid gap-4 xl:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-semibold text-brand-950 mb-2">Submitted</h4>
                            {submittedRows.length === 0 ? (
                              <p className="text-sm text-stone-500">No student has submitted yet.</p>
                            ) : (
                              <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                                {submittedRows.map((row) => {
                                  const isLate = row.submission.createdAt > assignment.dueAt;
                                  return (
                                    <div key={row.submission.id} className="p-3 flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-brand-950 truncate">
                                          {row.rollNumber} - {row.studentName}
                                        </p>
                                        <p className={`text-xs ${isLate ? 'text-amber-600 font-medium' : 'text-stone-500'}`}>
                                          {isLate ? 'Late Submitted' : 'Submitted'} {row.submission.createdAt.toLocaleString("en-US", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                            timeZone: "UTC",
                                          })}
                                        </p>
                                      </div>
                                      <a
                                        href={row.submission.fileKey}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline shrink-0"
                                      >
                                        Open
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-brand-950 mb-2">Pending</h4>
                            {pendingStudents.length === 0 ? (
                              <p className="text-sm text-stone-500">Everyone has submitted.</p>
                            ) : (
                              <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                                {pendingStudents.map((student) => (
                                  <div key={student.id} className="p-3 text-sm text-stone-700">
                                    {student.classRollNumber} - {student.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
