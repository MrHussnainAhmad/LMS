import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { staff, students } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { count, eq } from "drizzle-orm";
import { CheckSquare, MapPin, Users, UserSquare2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function InstitutionDashboard() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const instId = session.userId;
  const [studentCount] = await db.select({ value: count() }).from(students).where(eq(students.institutionId, instId));
  const [staffCount] = await db.select({ value: count() }).from(staff).where(eq(staff.institutionId, instId));
  const recentAnnouncements = await getVisibleAnnouncements(session, 4);

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-stone-50/50 rounded-md border border-border mt-4">
            <p className="text-stone-500 text-sm">Attendance module not yet enabled for your institution.</p>
          </CardContent>
        </Card>

        <DashboardAnnouncements announcements={recentAnnouncements} />
      </div>
    </div>
  );
}
