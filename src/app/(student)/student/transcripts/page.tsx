import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getStudentBatchReports } from '@/lib/batch-exams';
import { FileText, ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TranscriptsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.userId) redirect("/login");

  const publishedExams = await getStudentBatchReports(session.institutionId!, session.userId);

  return (
    <div className="space-y-8 animate-fade-in">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {publishedExams.map(exam => (
          <Card key={exam.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center mb-2">
                <FileText className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex items-center justify-between gap-2"><CardTitle>{exam.title}</CardTitle><span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">{exam.type}</span></div>
              <CardDescription>Published {exam.createdAt.toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/student/transcripts/${exam.id}`} prefetch={false}>
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
              <p className="text-sm mt-1">Transcripts will appear here once your institution approves and publishes them.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
