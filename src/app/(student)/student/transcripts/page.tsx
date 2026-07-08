import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { batchExamResults, batchExamSubjects, batchExams } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { FileText, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TranscriptsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.userId) redirect("/login");

  // Fetch all batch exams the student has results for
  const rawResults = await db.select({
    examId: batchExams.id,
    examTitle: batchExams.title,
    examCreatedAt: batchExams.createdAt,
    subjectId: batchExamSubjects.id,
    isPublished: batchExamSubjects.isPublished,
    reviewDeadline: batchExamSubjects.reviewDeadline,
  })
  .from(batchExamResults)
  .innerJoin(batchExamSubjects, eq(batchExamResults.batchExamSubjectId, batchExamSubjects.id))
  .innerJoin(batchExams, eq(batchExamSubjects.batchExamId, batchExams.id))
  .where(eq(batchExamResults.studentId, session.userId));

  // Group by Exam
  const examMap = new Map<number, { id: number, title: string, createdAt: Date, subjects: any[] }>();
  
  const now = new Date();
  
  for (const r of rawResults) {
    if (!examMap.has(r.examId)) {
      examMap.set(r.examId, {
        id: r.examId,
        title: r.examTitle,
        createdAt: r.examCreatedAt,
        subjects: []
      });
    }
    
    const isEffectivelyPublished = r.isPublished || now > r.reviewDeadline;
    examMap.get(r.examId)?.subjects.push({
      ...r,
      isEffectivelyPublished
    });
  }

  // A batch exam is published if ALL its subjects are effectively published
  const publishedExams = Array.from(examMap.values()).filter(exam => 
    exam.subjects.every(s => s.isEffectivelyPublished)
  ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">My Transcripts</h1>
        <p className="text-stone-500 mt-1">View your term exams and final transcripts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {publishedExams.map(exam => (
          <Card key={exam.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center mb-2">
                <FileText className="h-5 w-5 text-brand-600" />
              </div>
              <CardTitle>{exam.title}</CardTitle>
              <CardDescription>Published {exam.createdAt.toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/student/transcripts/${exam.id}`}>
                <Button className="w-full justify-between group">
                  View Transcript
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {publishedExams.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3 bg-stone-50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center h-48 text-stone-500">
              <FileText className="h-10 w-10 mb-3 text-stone-400" />
              <p>No transcripts are available at this time.</p>
              <p className="text-sm mt-1">Transcripts will appear here once all subject teachers have published their results.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
