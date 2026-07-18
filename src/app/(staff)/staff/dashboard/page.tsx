import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, FileEdit } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { staffAssignments, sections, classes, subjects, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { TodayTimetableCard, type TimetableEntry } from "@/components/timetable/ScheduleViews";

import { StaffLeaveRequestButton } from "./StaffLeaveRequestButton";

export default async function StaffDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'STAFF') {
    redirect('/login');
  }

  const staffId = session.userId;
  if (!session.institutionId) redirect('/login');
  const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

  const [staffRows, scheduleRows, recentAnnouncements] = await Promise.all([
    db.select({ name: staff.name }).from(staff).where(and(eq(staff.id, staffId), eq(staff.institutionId, session.institutionId))).limit(1),
    db.select({
      id: staffAssignments.id,
      startTime: staffAssignments.startTime,
      endTime: staffAssignments.endTime,
      subject: subjects.name,
      className: classes.name,
      sectionName: sections.name,
    })
      .from(staffAssignments)
      .innerJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .where(and(
        eq(staffAssignments.staffId, staffId),
        eq(staffAssignments.institutionId, session.institutionId),
        eq(staffAssignments.dayOfWeek, currentDay)
      )),
    getVisibleAnnouncements(session, 4),
  ]);
  const currentStaff = staffRows[0];

  // Sort by start time manually for simplicity
  scheduleRows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayEntries: TimetableEntry[] = scheduleRows.map((row) => ({
    id: row.id,
    dayOfWeek: currentDay,
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.subject || "Subject",
    meta: `${row.className}-${row.sectionName}`,
  }));
  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Welcome, {currentStaff?.name || "Staff"}</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Here is your schedule for today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <TodayTimetableCard entries={todayEntries} title="Today's Teaching Timetable" />
        </div>

        <div className="space-y-4 mt-8 lg:mt-0">
          <h2 className="text-lg font-semibold text-brand-900 px-1">Quick Links</h2>
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Link href="/staff/attendance" className="flex flex-col items-center justify-center p-4 rounded-lg bg-stone-50 hover:bg-brand-50 hover:text-brand-800 transition-colors text-stone-600 text-center gap-2 border border-transparent hover:border-brand-200">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">Mark Attendance</span>
              </Link>
              <Link href="/staff/marks" className="flex flex-col items-center justify-center p-4 rounded-lg bg-stone-50 hover:bg-brand-50 hover:text-brand-800 transition-colors text-stone-600 text-center gap-2 border border-transparent hover:border-brand-200">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <FileEdit className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">Enter Marks</span>
              </Link>
              <StaffLeaveRequestButton />
            </CardContent>
          </Card>
          <DashboardAnnouncements announcements={recentAnnouncements} />
        </div>
      </div>
    </div>
  );
}
