import { NextRequest, NextResponse } from "next/server";
import { saveStudentSubmission } from "@/app/actions/assessment-actions";
import { db } from "@/db";
import { assignments, submissions, students, subjects } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, or, isNull } from "drizzle-orm";

export const GET = requireRole(["STUDENT"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Fetch student info and submissions in parallel
    const [studentRows, studentSubmissions] = await Promise.all([
      db.select({ classId: students.classId, sectionId: students.sectionId })
        .from(students)
        .where(eq(students.id, session.userId)),
      db.select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.studentId, session.userId),
          eq(submissions.institutionId, session.institutionId)
        )
      )
    ]);

    const student = studentRows[0];
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    // 2. Fetch assignments for that class/section
    const studentAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        referenceFileUrl: assignments.referenceFileUrl,
        referenceFileName: assignments.referenceFileName,
        dueAt: assignments.dueAt,
        subjectName: subjects.name,
      })
      .from(assignments)
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(
        and(
          eq(assignments.institutionId, session.institutionId),
          eq(assignments.classId, student.classId),
          // sectionId can be null if assignment is for whole class, or match student's section
          or(eq(assignments.sectionId, student.sectionId), isNull(assignments.sectionId))
        )
      )
      .orderBy(desc(assignments.dueAt));

    const submissionMap = new Map(studentSubmissions.map(sub => [sub.assignmentId, sub]));

    const result = studentAssignments.map(a => ({
      ...a,
      submission: submissionMap.get(a.id) || null,
    }));

    return NextResponse.json({ assignments: result });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const assignmentId = Number(body.assignmentId);
    const fileKey = String(body.fileKey || "").trim();

    if (!Number.isInteger(assignmentId) || assignmentId <= 0 || !fileKey) {
      return NextResponse.json({ error: "Assignment and uploaded file are required" }, { status: 400 });
    }

    await saveStudentSubmission(assignmentId, fileKey);
    return NextResponse.json({ message: "Submission saved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
