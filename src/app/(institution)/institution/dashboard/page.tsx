import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { staff, students, platformReviews, attendances, classes, tests, marks } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { count, eq, and, gte, desc, sql } from "drizzle-orm";
import { CheckSquare, MapPin, Users, UserSquare2 } from "lucide-react";
import { redirect } from "next/navigation";
import { PlatformReviewForm } from "@/components/PlatformReviewForm";
import { Star } from "lucide-react";
import Link from "next/link";
import { AttendanceTrendsChartDeferred } from "@/components/institution/AttendanceTrendsChartDeferred";
import { getCachedOrFetch } from "@/lib/redis";
import { ClassDistributionChart } from "@/components/institution/ClassDistributionChart";
import { ExamPerformanceChart } from "@/components/institution/ExamPerformanceChart";

export default async function InstitutionDashboard() {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");

  const instId = session.institutionId || session.userId;
  // Calculate last 7 days of attendance
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const todayStr = last7Days[6];

  const [studentCountRows, staffCountRows, recentAnnouncements, reviewRows, recentAttendance, classDistRows, examPerfRows] = await Promise.all([
    getCachedOrFetch(`cache:dashboard:students:${instId}`, 60, () =>
      db.select({ value: count() }).from(students).where(eq(students.institutionId, instId))
    ),
    getCachedOrFetch(`cache:dashboard:staff:${instId}`, 60, () =>
      db.select({ value: count() }).from(staff).where(eq(staff.institutionId, instId))
    ),
    getVisibleAnnouncements(session, 4),
    getCachedOrFetch(`cache:dashboard:reviews:${instId}`, 60, () => 
      db.select().from(platformReviews).where(eq(platformReviews.institutionId, instId)).limit(1)
    ),
    getCachedOrFetch(`cache:dashboard:attendance:${instId}:${last7Days[0]}`, 60, () =>
      db.select({ date: attendances.date, status: attendances.status, value: count() })
        .from(attendances)
        .where(and(eq(attendances.institutionId, instId), gte(attendances.date, last7Days[0])))
        .groupBy(attendances.date, attendances.status)
    ),
    getCachedOrFetch(`cache:dashboard:class-dist:${instId}`, 60, () =>
      db.select({
        name: classes.name,
        value: count(students.id)
      })
      .from(classes)
      .leftJoin(students, eq(students.classId, classes.id))
      .where(eq(classes.institutionId, instId))
      .groupBy(classes.id, classes.name)
      .orderBy(classes.level)
    ),
    getCachedOrFetch(`cache:dashboard:exam-perf:${instId}`, 60, () =>
      db.select({
        title: tests.title,
        average: sql<number>`avg(${marks.marksObtained} / ${marks.totalMarks} * 100)`
      })
      .from(tests)
      .innerJoin(marks, eq(marks.testId, tests.id))
      .where(eq(tests.institutionId, instId))
      .groupBy(tests.id, tests.title, tests.createdAt)
      .orderBy(desc(tests.createdAt))
      .limit(5)
    )
  ]);
  const studentCount = studentCountRows[0];
  const staffCount = staffCountRows[0];
  const existingReview = reviewRows[0];

  const examPerfData = examPerfRows.map(r => ({
    title: r.title.length > 10 ? r.title.substring(0, 10) + '...' : r.title,
    average: Number(r.average) || 0
  })).reverse();

  const trendMap = new Map<string, { date: string, PRESENT: number, ABSENT: number, LEAVE: number, LATE: number }>();
  
  for (const date of last7Days) {
    const d = new Date(date);
    const shortDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    trendMap.set(date, { date: shortDate, PRESENT: 0, ABSENT: 0, LEAVE: 0, LATE: 0 });
  }

  let todayPresent = 0;
  let todayTotal = 0;

  for (const record of recentAttendance) {
    const dateStr = record.date;
    const entry = trendMap.get(dateStr);
    if (entry && record.status) {
      entry[record.status as keyof Omit<typeof entry, 'date'>] = ((entry[record.status as keyof Omit<typeof entry, 'date'>] as number) || 0) + record.value;
    }

    if (dateStr === todayStr) {
      todayTotal += record.value;
      if (record.status === 'PRESENT') todayPresent += record.value;
    }
  }

  const trendsData = Array.from(trendMap.values());
  const todayAttendanceStr = todayTotal > 0 ? `${Math.round((todayPresent / todayTotal) * 100)}%` : '--';

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
        <Link href="/institution/staff-attendance" className="block h-full group focus:outline-none">
          <StatCard 
            title="Today's Attendance" 
            value={todayAttendanceStr} 
            icon={CheckSquare} 
            className="group-hover:ring-2 group-hover:ring-brand-500 transition-all cursor-pointer h-full"
          />
          <p className="text-xs text-brand-600 mt-2 font-medium flex items-center justify-end group-hover:underline">
            View Teacher's Attendance &rarr;
          </p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] mt-4 p-0 pb-4">
              <AttendanceTrendsChartDeferred data={trendsData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Exam Performance</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] mt-4 p-0 pb-4">
              <ExamPerformanceChart data={examPerfData} />
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
                <p className="text-stone-500 text-sm mb-4">Your feedback helps us improve Nisaab360 and will be featured on our homepage.</p>
                <PlatformReviewForm />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Class Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] mt-4 p-0 pb-4">
              <ClassDistributionChart data={classDistRows} />
            </CardContent>
          </Card>

          <DashboardAnnouncements announcements={recentAnnouncements} />
        </div>
      </div>
    </div>
  );
}
