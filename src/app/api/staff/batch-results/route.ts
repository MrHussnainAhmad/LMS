import { db } from "@/db";
import { batchExams, batchExamSubjects, classes, sections, subjects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STAFF" || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignedSubjects = await db.select({
      id: batchExamSubjects.id,
      maxMarks: batchExamSubjects.maxMarks,
      isPublished: batchExamSubjects.isPublished,
      reviewDeadline: batchExamSubjects.reviewDeadline,
      subjectName: subjects.name,
      examTitle: batchExams.title,
      className: classes.name,
      sectionName: sections.name,
      createdAt: batchExamSubjects.createdAt,
    })
    .from(batchExamSubjects)
    .innerJoin(batchExams, eq(batchExamSubjects.batchExamId, batchExams.id))
    .innerJoin(subjects, eq(batchExamSubjects.subjectId, subjects.id))
    .innerJoin(classes, eq(batchExams.classId, classes.id))
    .leftJoin(sections, eq(batchExams.sectionId, sections.id))
    .where(eq(batchExamSubjects.staffId, session.userId))
    .orderBy(desc(batchExamSubjects.createdAt));

    // Calculate effective publish status
    const now = new Date();
    const results = assignedSubjects.map(sub => ({
      ...sub,
      isEffectivelyPublished: sub.isPublished || now > sub.reviewDeadline
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("Fetch batch results error:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
