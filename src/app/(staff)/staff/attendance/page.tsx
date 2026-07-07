import { db } from "@/db";
import { staffAssignments, sections, classes, students } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AttendanceClient } from "./AttendanceClient";
import { attendances } from "@/db/schema";

export default async function AttendancePage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") redirect("/login");
  if (!session.institutionId) redirect("/login");

  const staffId = session.userId;

  // 1. Fetch all assignments for today to dynamically determine the "Class Incharge"
  // The Class Incharge for a day is the teacher who has the FIRST chronological lecture for that section today.
  const today = new Date();
  let currentDayOfWeek = today.getDay();
  if (currentDayOfWeek === 0) currentDayOfWeek = 7; // Convert Sunday(0) to 7 if your system uses 1=Monday...7=Sunday
  
  const allTodayAssignments = await db.select({
    sectionId: staffAssignments.sectionId,
    staffId: staffAssignments.staffId,
    startTime: staffAssignments.startTime,
  })
  .from(staffAssignments)
  .where(and(
    eq(staffAssignments.institutionId, session.institutionId),
    eq(staffAssignments.dayOfWeek, currentDayOfWeek)
  ));

  // Find the first lecture for each section today
  const firstTeacherBySection: Record<number, { staffId: number, startTime: string }> = {};
  for (const assignment of allTodayAssignments) {
    if (!assignment.staffId) continue;
    const staffIdForAssignment = assignment.staffId as number;
    
    if (!firstTeacherBySection[assignment.sectionId]) {
      firstTeacherBySection[assignment.sectionId] = { staffId: staffIdForAssignment, startTime: assignment.startTime };
    } else {
      // Compare start times to find the earliest
      if (assignment.startTime < firstTeacherBySection[assignment.sectionId].startTime) {
        firstTeacherBySection[assignment.sectionId] = { staffId: staffIdForAssignment, startTime: assignment.startTime };
      }
    }
  }

  // Filter the sections where THIS staff member is the first teacher
  const authorizedSectionIds = Object.keys(firstTeacherBySection)
    .map(Number)
    .filter(sectionId => firstTeacherBySection[sectionId].staffId === staffId);

  // Get distinct sections details for authorized sections
  const assignments = authorizedSectionIds.length > 0 ? await db.selectDistinct({
    id: sections.id,
    name: sections.name,
    classId: sections.classId,
    className: classes.name,
  })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(and(inArray(sections.id, authorizedSectionIds), eq(sections.institutionId, session.institutionId))) : [];

  const sectionIds = assignments.map(a => a.id);
  
  const allStudents = sectionIds.length > 0 ? await db.select({
    id: students.id,
    name: students.name,
    loginRollNumber: students.loginRollNumber,
    sectionId: students.sectionId,
  })
    .from(students)
    .where(and(eq(students.institutionId, session.institutionId), inArray(students.sectionId, sectionIds))) : [];

  const studentsBySection: Record<number, any[]> = {};
  allStudents.forEach(student => {
    if (!studentsBySection[student.sectionId]) {
      studentsBySection[student.sectionId] = [];
    }
    studentsBySection[student.sectionId].push(student);
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecords = sectionIds.length > 0 ? await db.select({
    sectionId: attendances.sectionId,
    studentId: attendances.studentId,
    status: attendances.status
  })
    .from(attendances)
    .where(and(eq(attendances.date, todayStr), inArray(attendances.sectionId, sectionIds))) : [];

  const todayAttendanceBySection: Record<number, boolean> = {};
  todayRecords.forEach(record => {
    todayAttendanceBySection[record.sectionId] = true;
  });

  return (
    <AttendanceClient 
      assignedSections={assignments} 
      studentsBySection={studentsBySection} 
      todayAttendanceBySection={todayAttendanceBySection}
    />
  );
}
