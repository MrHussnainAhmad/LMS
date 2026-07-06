import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Users, CheckSquare, FileEdit } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { staffAssignments, sections, classes, subjects, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function StaffDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'STAFF') {
    redirect('/login');
  }

  const staffId = session.userId;
  const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Get staff name
  const [currentStaff] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId));

  // Get today's schedule
  const scheduleRows = await db.select({
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
  .where(
    and(
      eq(staffAssignments.staffId, staffId),
      eq(staffAssignments.dayOfWeek, currentDay)
    )
  );

  // Sort by start time manually for simplicity
  scheduleRows.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Welcome, {currentStaff?.name || "Staff"}</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Here is your schedule for today.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-brand-900 px-1">Today's Timeline</h2>
          
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:ml-[4.5rem] md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {scheduleRows.length === 0 && (
              <p className="text-stone-500 py-4 ml-12">You have no classes scheduled for today.</p>
            )}
            {scheduleRows.map((item, index) => (
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-brand-100 text-brand-800 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                  <Clock className="h-4 w-4" />
                </div>
                <Card className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] shadow-sm transition-all ${index === 0 ? 'ring-2 ring-brand-800' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-brand-800 bg-brand-50 px-2 py-1 rounded">{item.startTime} - {item.endTime}</span>
                      {index === 0 && <span className="flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span></span>}
                    </div>
                    <h3 className="font-bold text-brand-950">{item.subject}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.className}-{item.sectionName}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 mt-8 lg:mt-0">
          <h2 className="text-lg font-semibold text-brand-900 px-1">Quick Links</h2>
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-4">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
