import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileEdit, ClipboardList } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StaffMarksPage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Marks Entry</h1>
          <p className="text-stone-500 mt-1">Record and publish student test scores.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-brand-600" />
            Active Assessments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
              <ClipboardList className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-800">No Active Assessments</h3>
              <p className="text-stone-500 max-w-md mx-auto mt-2">
                There are currently no tests or exams assigned to your sections that require grading. Check back later when assessments are created.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
