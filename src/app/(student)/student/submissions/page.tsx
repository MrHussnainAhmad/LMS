import { db } from "@/db";
import { assignments, students, subjects, submissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SubmissionsClient } from "./SubmissionsClient";

export default async function StudentSubmissionsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) redirect("/login");

  const [student] = await db.select().from(students).where(eq(students.id, session.userId)).limit(1);
  if (!student || student.institutionId !== session.institutionId) redirect("/login");

  const rows = await db.select({
    assignment: assignments,
    subjectName: subjects.name,
    fileKey: submissions.fileKey,
  })
    .from(assignments)
    .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
    .leftJoin(submissions, and(eq(submissions.assignmentId, assignments.id), eq(submissions.studentId, student.id)))
    .where(
      and(
        eq(assignments.institutionId, session.institutionId),
        eq(assignments.classId, student.classId),
        or(eq(assignments.sectionId, student.sectionId), isNull(assignments.sectionId))
      )
    );

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Submissions</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Upload files only for assignments created for your class.</p>
      </div>

      <SubmissionsClient
        assignments={rows.map(({ assignment, subjectName, fileKey }) => ({
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          dueAtLabel: assignment.dueAt.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }),
          subjectName,
          referenceFileUrl: assignment.referenceFileUrl,
          referenceFileName: assignment.referenceFileName,
          submittedFileKey: fileKey,
        }))}
      />
    </div>
  );
}
