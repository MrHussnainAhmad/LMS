import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { staff, students, platformReviews } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { count, eq } from "drizzle-orm";
import { CheckSquare, MapPin, Users, UserSquare2 } from "lucide-react";
import { redirect } from "next/navigation";
import { PlatformReviewForm } from "@/components/PlatformReviewForm";
import { Star } from "lucide-react";

export default async function InstitutionDashboard() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const instId = session.userId;
  const [studentCount] = await db.select({ value: count() }).from(students).where(eq(students.institutionId, instId));
  const [staffCount] = await db.select({ value: count() }).from(staff).where(eq(staff.institutionId, instId));
  const recentAnnouncements = await getVisibleAnnouncements(session, 4);
  const [existingReview] = await db.select().from(platformReviews).where(eq(platformReviews.institutionId, instId)).limit(1);

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
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center bg-stone-50/50 rounded-md border border-border mt-4">
              <p className="text-stone-500 text-sm">Attendance module not yet enabled for your institution.</p>
            </CardContent>
          </Card>
          
          {!existingReview && (
            <Card className="border-brand-200 bg-brand-50/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-brand-800">
                  <Star className="h-5 w-5 fill-brand-600 text-brand-600" />
                  Leave a Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-stone-500 text-sm mb-4">Your feedback helps us improve Taleem360 and will be featured on our homepage.</p>
                <PlatformReviewForm />
              </CardContent>
            </Card>
          )}
        </div>

        <DashboardAnnouncements announcements={recentAnnouncements} />
      </div>
    </div>
  );
}
