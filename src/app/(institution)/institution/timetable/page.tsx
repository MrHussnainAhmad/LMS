import { db } from "@/db";
import { classes, sections, staffAssignments, subjects, staff } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Plus, Clock } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTimetableAssignmentAction } from "@/app/actions/institution-actions";
import { cn } from "@/lib/utils";
import { SectionSelector } from "./SectionSelector";
import { AssignmentForm } from "./AssignmentForm";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function InstitutionTimetablePage({ searchParams }: { searchParams: { sectionId?: string } }) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");
  const institutionId = session.userId;

  const allSections = await db.select({
    section: sections,
    className: classes.name
  }).from(sections).innerJoin(classes, eq(sections.classId, classes.id)).where(eq(sections.institutionId, institutionId));

  const allSubjects = await db.select().from(subjects).where(eq(subjects.institutionId, institutionId));
  const allStaff = await db.select().from(staff).where(eq(staff.institutionId, institutionId));

  const selectedSectionId = searchParams.sectionId ? parseInt(searchParams.sectionId, 10) : (allSections[0]?.section.id || null);

  let assignments: any[] = [];
  if (selectedSectionId) {
    assignments = await db.select({
      assignment: staffAssignments,
      subject: subjects.name,
      teacher: staff.name
    }).from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
      .where(eq(staffAssignments.sectionId, selectedSectionId))
      .orderBy(staffAssignments.startTime);
  }

  async function createAssignment(formData: FormData) {
    "use server";
    await createTimetableAssignmentAction(formData);
  }

  // Group assignments by Day (1 = Monday, ..., 6 = Saturday)
  const groupedByDay: Record<number, any[]> = {};
  for (let i = 1; i <= 6; i++) groupedByDay[i] = []; 
  assignments.forEach(a => {
    if (groupedByDay[a.assignment.dayOfWeek]) {
      groupedByDay[a.assignment.dayOfWeek].push(a);
    }
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Timetable Manager</h1>
          <p className="text-stone-500 mt-1">Assign teachers, subjects, and timeslots for classes.</p>
        </div>
        {allSections.length > 0 && (
          <SectionSelector 
            sections={allSections.map(s => ({ id: s.section.id, name: s.section.name, className: s.className }))} 
            defaultSectionId={selectedSectionId} 
          />
        )}
      </div>

      {allSections.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-brand-900">No Sections Found</h3>
          <p className="text-stone-500 mt-2 max-w-md mx-auto">
            You need to create Classes and Sections in the Academics tab before you can build a timetable.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="border-b border-border bg-stone-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brand-600" />
                  Weekly Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[1, 2, 3, 4, 5, 6].map(dayIdx => {
                    const dayName = DAYS[dayIdx];
                    const dayAssignments = groupedByDay[dayIdx];
                    return (
                      <div key={dayIdx} className="p-6 flex flex-col sm:flex-row gap-6 hover:bg-stone-50/30 transition-colors">
                        <div className="w-32 flex-shrink-0">
                          <h3 className="font-bold text-brand-900">{dayName}</h3>
                          <p className="text-xs text-stone-500 mt-1">{dayAssignments.length} slots</p>
                        </div>
                        <div className="flex-1">
                          {dayAssignments.length === 0 ? (
                            <div className="text-sm text-stone-400 italic py-2">No classes scheduled</div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                              {dayAssignments.map((a, idx) => (
                                <div key={idx} className={cn("border border-border rounded-md p-3 shadow-sm flex flex-col gap-2", a.assignment.isBreak ? "bg-stone-50" : "bg-white")}>
                                  <div className="flex justify-between items-start">
                                    <span className={cn("font-semibold text-sm truncate pr-2", a.assignment.isBreak ? "text-stone-600 italic" : "text-brand-900")}>
                                      {a.assignment.isBreak ? "Break / Recess" : a.subject}
                                    </span>
                                    <span className="text-[10px] font-mono bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                                      {a.assignment.startTime.substring(0,5)} - {a.assignment.endTime.substring(0,5)}
                                    </span>
                                  </div>
                                  {!a.assignment.isBreak && a.teacher && (
                                    <div className="text-xs text-stone-600 flex items-center gap-1.5">
                                      <div className="w-4 h-4 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-[8px]">
                                        {a.teacher.substring(0, 1)}
                                      </div>
                                      <span className="truncate">{a.teacher}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6">
              <CardHeader className="border-b border-border bg-stone-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-brand-600" />
                  Assign Time Slot
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <AssignmentForm 
                  sectionId={selectedSectionId} 
                  subjects={allSubjects.map(s => ({ id: s.id, name: s.name }))}
                  staff={allStaff.map(s => ({ id: s.id, name: s.name }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
