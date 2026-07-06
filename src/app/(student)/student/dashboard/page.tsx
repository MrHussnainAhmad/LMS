import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, Megaphone, UploadCloud } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { students, staffAssignments, subjects, staff, submissions, announcements } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

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

  // Get total submissions
  const studentSubmissions = await db.select().from(submissions).where(eq(submissions.studentId, studentId));

  // Get announcements
  const recentAnnouncements = await db.select()
    .from(announcements)
    .where(eq(announcements.institutionId, currentStudent.institutionId))
    .orderBy(desc(announcements.createdAt))
    .limit(3);

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
                <h3 className="text-4xl font-display font-bold">--</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-teal-100 text-xs mt-4">No recent test marks found.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Today's Classes</CardTitle>
            <Clock className="h-4 w-4 text-stone-400" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scheduleRows.length === 0 && (
                <p className="text-stone-500 py-4 text-sm">You have no classes scheduled for today.</p>
              )}
              {scheduleRows.map((cls) => (
                <div key={cls.id} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-surface">
                  <div className="flex-shrink-0 w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-bold">
                    {cls.startTime.substring(0, 5)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-brand-950">
                      {cls.subject || "Break / Recess"}
                    </h4>
                    <p className="text-sm text-stone-500 flex items-center gap-2 mt-1">
                      {cls.teacher && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {cls.teacher}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {cls.startTime.substring(0, 5)} - {cls.endTime.substring(0, 5)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Announcements</CardTitle>
            <Megaphone className="h-4 w-4 text-stone-400" />
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAnnouncements.length === 0 && (
              <p className="text-stone-500 py-2 text-sm">No new announcements.</p>
            )}
            {recentAnnouncements.map(ann => (
              <div key={ann.id} className="border-l-2 border-brand-500 pl-3 py-1">
                <p className="text-sm font-semibold text-brand-900">{ann.title}</p>
                <p className="text-xs text-stone-500 mt-1">{new Date(ann.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
