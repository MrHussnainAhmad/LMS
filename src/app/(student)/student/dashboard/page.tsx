import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, UploadCloud, FileText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { students, staffAssignments, subjects, staff, submissions, marks, tests } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { TodayTimetableCard, type TimetableEntry } from "@/components/timetable/ScheduleViews";
import Link from "next/link";

import { StudentLeaveRequestButton } from "./StudentLeaveRequestButton";

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') {
    redirect('/login');
  }

  const studentId = session.userId;
  if (!session.institutionId) redirect('/login');
  const currentDay = new Date().getDay();

  // Get student details
  const [currentStudent] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.institutionId, session.institutionId)));
  if (!currentStudent) redirect('/login');

  const [scheduleRows, submissionCountRows, latestMarkRows, recentAnnouncements] = await Promise.all([
    db.select({
      id: staffAssignments.id,
      startTime: staffAssignments.startTime,
      endTime: staffAssignments.endTime,
      subject: subjects.name,
      teacher: staff.name,
    })
      .from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
      .where(and(
        eq(staffAssignments.sectionId, currentStudent.sectionId),
        eq(staffAssignments.institutionId, session.institutionId),
        eq(staffAssignments.dayOfWeek, currentDay)
      )),
    db.select({ value: count() }).from(submissions).where(and(
      eq(submissions.studentId, studentId),
      eq(submissions.institutionId, session.institutionId)
    )),
    db.select({ mark: marks, test: tests, subjectName: subjects.name })
      .from(marks)
      .innerJoin(tests, eq(marks.testId, tests.id))
      .leftJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(and(eq(marks.studentId, studentId), eq(marks.institutionId, currentStudent.institutionId)))
      .orderBy(desc(marks.createdAt))
      .limit(1),
    getVisibleAnnouncements(session, 4),
  ]);
  const submissionCount = submissionCountRows[0]?.value || 0;
  const latestMark = latestMarkRows[0];

  scheduleRows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayEntries: TimetableEntry[] = scheduleRows.map((row) => ({
    id: row.id,
    dayOfWeek: currentDay,
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.subject || "Break / Recess",
    subtitle: row.teacher,
    isBreak: !row.subject,
  }));

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Hi, {currentStudent.name}</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Here is your academic overview.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-brand-800 to-brand-950 text-white border-none shadow-md">
          <CardContent className="p-3 lg:p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-brand-200 text-xs lg:text-sm font-medium mb-1">Total Submissions</p>
                <h3 className="text-xl lg:text-3xl font-display font-bold">{submissionCount}</h3>
              </div>
              <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border-2 border-brand-700 flex items-center justify-center shrink-0">
                <UploadCloud className="h-4 w-4 lg:h-5 lg:w-5 text-brand-200" />
              </div>
            </div>
            <p className="text-brand-300 text-xs mt-4">Keep up the good work!</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success to-teal-700 text-white border-none shadow-md">
          <CardContent className="p-3 lg:p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-teal-100 text-xs lg:text-sm font-medium mb-1">Latest Score</p>
                <h3 className="text-xl lg:text-3xl font-display font-bold">
                  {latestMark ? `${latestMark.mark.marksObtained}/${latestMark.mark.totalMarks}` : "--"}
                </h3>
              </div>
              <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
              </div>
            </div>
            <p className="text-teal-100 text-xs mt-4 truncate">
              {latestMark
                ? `${latestMark.test.type} - ${latestMark.subjectName || "Subject"} - ${latestMark.test.title}`
                : "No recent test marks found."}
            </p>
          </CardContent>
        </Card>

        <Link href="/student/transcripts" className="block h-full">
          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-800 text-white border-none shadow-md hover:shadow-lg transition-shadow h-full">
            <CardContent className="p-3 lg:p-4 h-full flex flex-col justify-center">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-xs lg:text-sm font-medium mb-1">Term Exams</p>
                  <h3 className="text-xl lg:text-2xl font-display font-bold leading-tight">View Transcripts</h3>
                </div>
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>
              </div>
              <p className="text-indigo-200 text-xs mt-4">Check full batch results.</p>
            </CardContent>
          </Card>
        </Link>
        
        <StudentLeaveRequestButton />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2">
          <TodayTimetableCard entries={todayEntries} title="Today's Classes" />
        </div>

        <DashboardAnnouncements announcements={recentAnnouncements} />
      </div>
    </div>
  );
}
