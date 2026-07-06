import { StatCard } from "@/components/ui/stat-card";
import { UserSquare2, Users, MapPin, CheckSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { students, staff } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export default async function InstitutionDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'INSTITUTION') {
    redirect('/login');
  }

  const instId = session.userId; // For institution admin, userId IS the institutionId in this schema

  const [studentCount] = await db.select({ value: count() }).from(students).where(eq(students.institutionId, instId));
  const [staffCount] = await db.select({ value: count() }).from(staff).where(eq(staff.institutionId, instId));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Institution Dashboard</h1>
        <p className="text-stone-500 mt-1">Overview of your campus activities and academics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value={studentCount.value.toString()} icon={Users} />
        <StatCard title="Teaching Staff" value={staffCount.value.toString()} icon={UserSquare2} />
        <StatCard title="Active Campuses" value="1" icon={MapPin} />
        <StatCard title="Today's Attendance" value="--" icon={CheckSquare} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-stone-50/50 rounded-md border border-border mt-4">
             <p className="text-stone-500 text-sm">Attendance module not yet enabled for your institution.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-brand-50 border border-brand-100">
              <h4 className="font-semibold text-brand-900 text-sm">Exam Schedule Released</h4>
              <p className="text-xs text-brand-700 mt-1">Mid-term exams will commence from 15th Nov.</p>
              <p className="text-xs text-stone-500 mt-2">To: All Students • 2 hours ago</p>
            </div>
            <div className="p-4 rounded-lg bg-surface border border-border">
              <h4 className="font-semibold text-brand-900 text-sm">Staff Meeting</h4>
              <p className="text-xs text-stone-600 mt-1">Monthly performance review meeting.</p>
              <p className="text-xs text-stone-500 mt-2">To: All Staff • 1 day ago</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
