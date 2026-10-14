import { and, asc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { classes, marks, sections, staff, staffAssignments, students, subjects, tests } from '@/db/schema';
import type { TeacherPerformancePoint } from '@/components/institution/TeacherPerformanceChart';
import type { TeacherPerformanceGroup } from '@/app/(institution)/institution/staff/[id]/performance/TeacherPerformancePanels';
const TEST_TYPES = ['DAILY','WEEKLY','MONTHLY'] as const;
function dateMonthsAgo(months: number) { const date=new Date(); date.setUTCMonth(date.getUTCMonth()-months); return date.toISOString().slice(0,10); }
export async function getTeacherPerformance(institutionId:number,staffId:number,months:number) {
  const [teacher] = await db.select({ id: staff.id, name: staff.name, email: staff.email, isActive: staff.isActive })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.institutionId, institutionId), isNull(staff.deletedAt)))
    .limit(1);
  if (!teacher) return null;

  const assignmentPairs = db.selectDistinct({
    sectionId: staffAssignments.sectionId,
    subjectId: staffAssignments.subjectId,
  })
    .from(staffAssignments)
    .where(and(
      eq(staffAssignments.institutionId, institutionId),
      eq(staffAssignments.staffId, staffId),
      eq(staffAssignments.isBreak, false),
      isNotNull(staffAssignments.subjectId),
    ))
    .as("teacher_assignment_pairs");

  const [assignments, resultRows] = await Promise.all([
    db.select({
      sectionId: assignmentPairs.sectionId,
      subjectId: assignmentPairs.subjectId,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
    })
      .from(assignmentPairs)
      .innerJoin(sections, and(eq(sections.id, assignmentPairs.sectionId), eq(sections.institutionId, institutionId)))
      .innerJoin(classes, and(eq(classes.id, sections.classId), eq(classes.institutionId, institutionId)))
      .innerJoin(subjects, and(eq(subjects.id, assignmentPairs.subjectId), eq(subjects.institutionId, institutionId)))
      .orderBy(classes.name, sections.name, subjects.name),
    db.select({
      sectionId: assignmentPairs.sectionId,
      subjectId: assignmentPairs.subjectId,
      testId: tests.id,
      title: tests.title,
      type: tests.type,
      date: tests.date,
      average: sql<number>`round(avg(case when ${marks.totalMarks} > 0 then ${marks.marksObtained} * 100.0 / ${marks.totalMarks} end)::numeric, 1)::float`,
      studentCount: sql<number>`count(${marks.id})::int`,
    })
      .from(assignmentPairs)
      .innerJoin(sections, and(eq(sections.id, assignmentPairs.sectionId), eq(sections.institutionId, institutionId)))
      .innerJoin(tests, and(
        eq(tests.institutionId, institutionId),
        eq(tests.classId, sections.classId),
        eq(tests.subjectId, assignmentPairs.subjectId),
        or(isNull(tests.sectionId), eq(tests.sectionId, assignmentPairs.sectionId)),
      ))
      .innerJoin(marks, and(eq(marks.testId, tests.id), eq(marks.institutionId, institutionId)))
      .innerJoin(students, and(
        eq(students.id, marks.studentId),
        eq(students.institutionId, institutionId),
        eq(students.sectionId, assignmentPairs.sectionId),
        isNull(students.deletedAt),
      ))
      .where(and(
        isNotNull(tests.resultsPublishedAt),
        inArray(tests.type, [...TEST_TYPES]),
        gte(tests.date, dateMonthsAgo(months)),
      ))
      .groupBy(assignmentPairs.sectionId, assignmentPairs.subjectId, tests.id, tests.title, tests.type, tests.date)
      .orderBy(asc(tests.date), asc(tests.id)),
  ]);

  const pointsByAssignment = new Map<string, TeacherPerformancePoint[]>();
  for (const row of resultRows) {
    const key = `${row.sectionId}:${row.subjectId}`;
    const points = pointsByAssignment.get(key) || [];
    points.push({
      id: row.testId,
      label: new Date(`${row.date}T00:00:00Z`).toLocaleDateString("en-PK", { day: "2-digit", month: "short", timeZone: "UTC" }),
      title: row.title,
      type: row.type,
      average: Number(row.average || 0),
      students: Number(row.studentCount || 0),
    });
    pointsByAssignment.set(key, points);
  }

  const allPoints = Array.from(pointsByAssignment.values()).flat();
  const assessedStudents = allPoints.reduce((sum, point) => sum + point.students, 0);
  const overallAverage = assessedStudents
    ? Math.round(allPoints.reduce((sum, point) => sum + point.average * point.students, 0) / assessedStudents)
    : null;
  const performanceGroups: TeacherPerformanceGroup[] = assignments.map((assignment) => {
    const key = `${assignment.sectionId}:${assignment.subjectId}`;
    const points = pointsByAssignment.get(key) || [];
    const resultCount = points.reduce((sum, point) => sum + point.students, 0);
    const average = resultCount ? Math.round(points.reduce((sum, point) => sum + point.average * point.students, 0) / resultCount) : null;
    return { key, className: assignment.className, sectionName: assignment.sectionName, subjectName: assignment.subjectName, average, points };
  });

return {teacher,assignments,allPoints,overallAverage,performanceGroups,months};
}
