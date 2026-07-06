import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Trophy } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentMarksPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">My Marks</h1>
          <p className="text-stone-500 mt-1">Review your test scores and academic performance.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-600" />
            Performance Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-800">No Grades Posted</h3>
              <p className="text-stone-500 max-w-md mx-auto mt-2">
                There are currently no graded assignments or test scores published for your account. Check back later after assessments are evaluated.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
