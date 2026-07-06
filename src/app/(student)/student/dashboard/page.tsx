import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { students, staffAssignments, subjects, staff, submissions, marks, tests } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { TodayTimetableCard, type TimetableEntry } from "@/components/timetable/ScheduleViews";

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT') {
    redirect('/login');
  }

  const studentId = session.userId;
  const currentDay = new Date().getDay();

  // Get student details
  const [currentStudent] = await db.select().from(students).where(eq(students.id, studentId));
  if (!currentStudent) redirect('/login');

  // Get today's classes
  const scheduleRows = await db.select({
    id: staffAssignments.id,
    startTime: staffAssignments.startTime,
    endTime: staffAssignments.endTime,
    subject: subjects.name,
    teacher: staff.name,
  })
  .from(staffAssignments)
  .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
  .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
  .where(
    and(
      eq(staffAssignments.sectionId, currentStudent.sectionId),
      eq(staffAssignments.dayOfWeek, currentDay)
    )
  );

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

  // Get total submissions
  const studentSubmissions = await db.select().from(submissions).where(eq(submissions.studentId, studentId));

  const [latestMark] = await db.select({
    mark: marks,
    test: tests,
    subjectName: subjects.name,
  })
    .from(marks)
    .innerJoin(tests, eq(marks.testId, tests.id))
    .leftJoin(subjects, eq(tests.subjectId, subjects.id))
    .where(and(eq(marks.studentId, studentId), eq(marks.institutionId, currentStudent.institutionId)))
    .orderBy(desc(marks.createdAt))
    .limit(1);

  const recentAnnouncements = await getVisibleAnnouncements(session, 4);

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Hi, {currentStudent.name}</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Here is your academic overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-brand-800 to-brand-950 text-white border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-brand-200 text-sm font-medium mb-1">Total Submissions</p>
                <h3 className="text-4xl font-display font-bold">{studentSubmissions.length}</h3>
              </div>
              <div className="h-12 w-12 rounded-full border-4 border-brand-700 flex items-center justify-center">
                <UploadCloud className="h-5 w-5 text-brand-200" />
              </div>
            </div>
            <p className="text-brand-300 text-xs mt-4">Keep up the good work!</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success to-teal-700 text-white border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-teal-100 text-sm font-medium mb-1">Latest Test Score</p>
                <h3 className="text-4xl font-display font-bold">
                  {latestMark ? `${latestMark.mark.marksObtained}/${latestMark.mark.totalMarks}` : "--"}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-teal-100 text-xs mt-4">
              {latestMark
                ? `${latestMark.test.type} - ${latestMark.subjectName || "Subject"} - ${latestMark.test.title}`
                : "No recent test marks found."}
            </p>
          </CardContent>
        </Card>
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
