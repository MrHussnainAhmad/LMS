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

  // Get distinct sections where this staff member is the class incharge
  const assignments = await db.selectDistinct({
    id: sections.id,
    name: sections.name,
    classId: sections.classId,
    className: classes.name,
  })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(and(eq(sections.classTeacherId, staffId), eq(sections.institutionId, session.institutionId)));

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
