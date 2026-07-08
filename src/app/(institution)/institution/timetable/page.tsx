import { db } from "@/db";
import { classes, sections, staffAssignments, subjects, staff, tests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Plus, User } from "lucide-react";
import { SectionSelector } from "./SectionSelector";
import { AssignmentForm } from "./AssignmentForm";
import { InchargeForm } from "./InchargeForm";
import { InstitutionExamForm } from "@/components/exams/InstitutionExamForm";
import { WeeklyTimetable, type TimetableEntry } from "@/components/timetable/ScheduleViews";

type TimetableRow = {
  assignment: typeof staffAssignments.$inferSelect;
  subject: string | null;
  teacher: string | null;
};

const WHOLE_CLASS_SECTION_NAME = "Whole Class";

type TimetableTarget = {
  value: string;
  label: string;
  classId: number;
  sectionId: number | null;
  classTeacherId: number | null;
};

export default async function InstitutionTimetablePage({ searchParams }: { searchParams: Promise<{ sectionId?: string; classId?: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");
  const institutionId = session.userId;
  const params = await searchParams;

  const allSections = await db.select({
    section: sections,
    className: classes.name
  }).from(sections).innerJoin(classes, eq(sections.classId, classes.id)).where(eq(sections.institutionId, institutionId));

  const allSubjects = await db.select().from(subjects).where(eq(subjects.institutionId, institutionId));
  const allStaff = await db.select().from(staff).where(eq(staff.institutionId, institutionId));
  const allClasses = await db.select().from(classes).where(eq(classes.institutionId, institutionId));

  const timetableTargets: TimetableTarget[] = allClasses.flatMap((classRow) => {
    const classSections = allSections.filter((row) => row.section.classId === classRow.id);
    const wholeClassSection = classSections.find((row) => row.section.name === WHOLE_CLASS_SECTION_NAME);
    const namedSections = classSections.filter((row) => row.section.name !== WHOLE_CLASS_SECTION_NAME);

    if (namedSections.length === 0) {
      return [{
        value: `class:${classRow.id}`,
        label: `${classRow.name} (whole class)`,
        classId: classRow.id,
        sectionId: wholeClassSection?.section.id || null,
        classTeacherId: wholeClassSection?.section.classTeacherId || null,
      }];
    }

    return namedSections.map((row) => ({
      value: `section:${row.section.id}`,
      label: `${classRow.name} - ${row.section.name}`,
      classId: classRow.id,
      sectionId: row.section.id,
      classTeacherId: row.section.classTeacherId,
    }));
  });

  const requestedSectionId = params.sectionId ? parseInt(params.sectionId, 10) : null;
  const requestedClassId = params.classId ? parseInt(params.classId, 10) : null;
  const selectedTarget = (
    Number.isInteger(requestedSectionId)
      ? timetableTargets.find((target) => target.sectionId === requestedSectionId)
      : Number.isInteger(requestedClassId)
        ? timetableTargets.find((target) => target.classId === requestedClassId && target.value.startsWith("class:"))
        : null
  ) || timetableTargets[0] || null;

  const selectedSectionId = selectedTarget?.sectionId || null;
  const selectedClassId = selectedTarget?.classId || null;

  let assignments: TimetableRow[] = [];
  let examRows: {
    id: number;
    title: string;
    type: string;
    date: string;
    endDate: string | null;
    maxMarks: number;
    subject: string | null;
  }[] = [];
  if (selectedSectionId) {
    assignments = await db.select({
      assignment: staffAssignments,
      subject: subjects.name,
      teacher: staff.name
    }).from(staffAssignments)
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .leftJoin(staff, eq(staffAssignments.staffId, staff.id))
      .where(and(eq(staffAssignments.sectionId, selectedSectionId), eq(staffAssignments.institutionId, institutionId)))
      .orderBy(staffAssignments.startTime);
  }

  const selectedClass = allClasses.find((classRow) => classRow.id === selectedClassId);
  if (selectedClass) {
    examRows = await db.select({
      id: tests.id,
      title: tests.title,
      type: tests.type,
      date: tests.date,
      endDate: tests.endDate,
      maxMarks: tests.maxMarks,
      subject: subjects.name,
    })
      .from(tests)
      .leftJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(and(
        eq(tests.institutionId, institutionId),
        eq(tests.classId, selectedClass.id),
        eq(tests.createdByRole, "INSTITUTION"),
        inArray(tests.type, ["MONTHLY", "MID", "FINAL"])
      ))
      .orderBy(tests.date);
  }

  const timetableEntries: TimetableEntry[] = assignments.map((row) => ({
    id: row.assignment.id,
    dayOfWeek: row.assignment.dayOfWeek,
    startTime: row.assignment.startTime,
    endTime: row.assignment.endTime,
    title: row.assignment.isBreak ? "Break / Recess" : row.subject || "Subject",
    subtitle: row.teacher,
    isBreak: row.assignment.isBreak,
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Timetable Manager</h1>
          <p className="text-stone-500 mt-1">Assign teachers, subjects, and timeslots for classes.</p>
        </div>
        {timetableTargets.length > 0 && (
          <SectionSelector 
            sections={timetableTargets.map((target) => ({ value: target.value, label: target.label }))} 
            defaultSectionId={selectedTarget?.value || null} 
          />
        )}
      </div>

      {timetableTargets.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-brand-900">No Classes Found</h3>
          <p className="text-stone-500 mt-2 max-w-md mx-auto">
            You need to create at least one class in the Academics tab before you can build a timetable.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <WeeklyTimetable
              entries={timetableEntries}
              title="Weekly Schedule"
              emptyTitle="No classes scheduled"
              emptyDescription="Use the form on the right to assign subjects, teachers, and periods."
            />
          </div>

          <div>
            <Card>
              <CardHeader className="border-b border-border bg-stone-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-brand-600" />
                  Class Incharge
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {selectedTarget && (
                  <InchargeForm 
                    key={selectedTarget.value}
                    sectionId={selectedSectionId} 
                    classId={selectedClassId}
                    currentInchargeId={selectedTarget.classTeacherId}
                    staff={allStaff.map(s => ({ id: s.id, name: s.name }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader className="border-b border-border bg-stone-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-brand-600" />
                  Assign Time Slot
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <AssignmentForm 
                  sectionId={selectedSectionId} 
                  classId={selectedClassId}
                  subjects={allSubjects.map(s => ({ id: s.id, name: s.name }))}
                  staff={allStaff.map(s => ({ id: s.id, name: s.name }))}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader className="border-b border-border bg-stone-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brand-600" />
                  Schedule Exam
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <InstitutionExamForm
                  classes={allClasses.map((classRow) => ({ id: classRow.id, name: classRow.name }))}
                  subjects={allSubjects.map((subject) => ({ id: subject.id, name: subject.name }))}
                  submitLabel="Add Exam Dates"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {examRows.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg">Exam Timetable</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {examRows.map((exam) => (
                <div key={exam.id} className="p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-brand-950">{exam.title}</h3>
                    <p className="text-sm text-stone-500">{exam.subject || "Subject"} - {exam.type}</p>
                  </div>
                  <div className="text-sm text-stone-600">
                    {new Date(exam.date).toLocaleDateString()}
                    {exam.endDate ? ` to ${new Date(exam.endDate).toLocaleDateString()}` : ""}
                    {" - "}{exam.maxMarks} marks
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
