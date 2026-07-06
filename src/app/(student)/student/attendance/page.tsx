import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckSquare, AlertCircle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentAttendancePage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Attendance Record</h1>
          <p className="text-stone-500 mt-1">Track your daily presence and absence history.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-brand-600" />
            Current Semester
          </CardTitle>
        </CardHeader>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-800">Records Pending</h3>
              <p className="text-stone-500 max-w-md mx-auto mt-2">
                Your daily attendance records have not been fully compiled or synced for this period. Please wait for your teachers to update the logs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
