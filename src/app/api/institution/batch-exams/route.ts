import { db } from "@/db";
import { batchExams, batchExamSubjects, batchExamResults, students, staffAssignments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "INSTITUTION" || !session.institutionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, classId, sectionId, subjects, studentMarks } = await req.json();

    if (!title || !classId || !subjects || !studentMarks) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch students by roll numbers to get their IDs
    const rollNumbers = studentMarks.map((s: any) => String(s.rollNumber));
    if (rollNumbers.length === 0) {
      return NextResponse.json({ error: "No students provided" }, { status: 400 });
    }

    const studentRecords = await db.select({
      id: students.id,
      classRollNumber: students.classRollNumber
    })
    .from(students)
    .where(
      and(
        eq(students.institutionId, session.institutionId),
        eq(students.classId, classId),
        inArray(students.classRollNumber, rollNumbers)
      )
    );

    const studentIdMap = new Map(studentRecords.map(s => [s.classRollNumber, s.id]));

    // 2. Fetch staff assignments to find subject teachers
    let assignments: any[] = [];
    if (sectionId) {
      assignments = await db.select({
        subjectId: staffAssignments.subjectId,
        staffId: staffAssignments.staffId
      })
      .from(staffAssignments)
      .where(
        and(
          eq(staffAssignments.institutionId, session.institutionId),
          eq(staffAssignments.sectionId, sectionId),
          inArray(staffAssignments.subjectId, subjects.map((s: any) => s.subjectId))
        )
      );
    }
    const staffIdMap = new Map(assignments.map(a => [a.subjectId, a.staffId]));

    // 3. Create records sequentially (transactions not supported in neon-http)
    // Create Batch Exam
    const [newExam] = await db.insert(batchExams).values({
      institutionId: session.institutionId!,
      classId,
      sectionId: sectionId || null,
      title
    }).returning({ id: batchExams.id });

    // Calculate review deadline (6 hours from now)
    const reviewDeadline = new Date();
    reviewDeadline.setHours(reviewDeadline.getHours() + 6);

    for (const subj of subjects) {
      const staffId = staffIdMap.get(subj.subjectId) || null;
      
      // Create Batch Exam Subject
      const [newSubject] = await db.insert(batchExamSubjects).values({
        batchExamId: newExam.id,
        subjectId: subj.subjectId,
        maxMarks: subj.maxMarks,
        staffId,
        reviewDeadline,
        isPublished: staffId ? false : true, // Auto-publish if no teacher assigned
      }).returning({ id: batchExamSubjects.id });

      // Insert results for this subject
      const resultsToInsert = [];
      for (const student of studentMarks) {
        const sId = studentIdMap.get(String(student.rollNumber));
        if (sId && student.marks[subj.subjectId] !== undefined && student.marks[subj.subjectId] !== null) {
          resultsToInsert.push({
            batchExamSubjectId: newSubject.id,
            studentId: sId,
            marksObtained: Number(student.marks[subj.subjectId]),
            isEdited: false
          });
        }
      }

      if (resultsToInsert.length > 0) {
        await db.insert(batchExamResults).values(resultsToInsert);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Batch exam upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload" }, { status: 500 });
  }
}
