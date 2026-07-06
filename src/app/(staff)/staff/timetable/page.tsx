import { db } from "@/db";
import { staffAssignments, subjects, classes, sections, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function StaffTimetablePage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    redirect("/login");
  }

  const staffId = session.userId;

  const assignments = await db.select({
    assignment: staffAssignments,
    subject: subjects.name,
    className: classes.name,
    sectionName: sections.name,
  })
    .from(staffAssignments)
    .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .leftJoin(classes, eq(sections.classId, classes.id))
    .where(eq(staffAssignments.staffId, staffId))
    .orderBy(staffAssignments.startTime);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">My Timetable</h1>
          <p className="text-stone-500 mt-1">View your weekly class schedule and teaching assignments.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brand-600" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center">
                <Clock className="h-8 w-8 text-brand-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-800">No Assignments Yet</h3>
                <p className="text-stone-500 max-w-md mx-auto mt-2">
                  You have not been assigned to any classes yet. Your timetable will appear here once published.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {DAYS.map((dayName, index) => {
                const dayAssignments = assignments.filter((a) => a.assignment.dayOfWeek === index);
                
                if (dayAssignments.length === 0) return null;

                return (
                  <div key={dayName} className="p-6">
                    <h3 className="font-semibold text-lg text-brand-950 mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-stone-400" />
                      {dayName}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {dayAssignments.map((a, idx) => (
                        <div key={idx} className={cn("border border-border rounded-md p-4 shadow-sm flex flex-col gap-2", a.assignment.isBreak ? "bg-stone-50" : "bg-white")}>
                          <div className="flex justify-between items-start">
                            <span className={cn("font-semibold text-sm truncate pr-2", a.assignment.isBreak ? "text-stone-600 italic" : "text-brand-900")}>
                              {a.assignment.isBreak ? "Break / Recess" : a.subject}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono bg-stone-100 text-stone-600 px-2 py-1 rounded inline-block w-fit">
                            {a.assignment.startTime.substring(0,5)} - {a.assignment.endTime.substring(0,5)}
                          </div>
                          {!a.assignment.isBreak && a.className && (
                            <div className="text-xs text-stone-600 flex items-center gap-2 mt-1">
                              <MapPin className="h-3.5 w-3.5 text-stone-400" />
                              <span className="truncate">{a.className} - {a.sectionName}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
