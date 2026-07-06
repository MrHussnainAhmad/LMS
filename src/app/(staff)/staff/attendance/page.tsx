import { db } from "@/db";
import { staffAssignments, sections, classes, students } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AttendanceClient } from "./AttendanceClient";

export default async function AttendancePage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") redirect("/login");

  const staffId = session.userId;

  // Get distinct sections assigned to this staff member
  const assignments = await db.selectDistinct({
    id: sections.id,
    name: sections.name,
    classId: sections.classId,
    className: classes.name,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(eq(staffAssignments.staffId, staffId));

  const sectionIds = assignments.map(a => a.id);
  
  const allStudents = sectionIds.length > 0 ? await db.select({
    id: students.id,
    name: students.name,
    loginRollNumber: students.loginRollNumber,
    sectionId: students.sectionId,
  })
    .from(students)
    .where(inArray(students.sectionId, sectionIds)) : [];

  const studentsBySection: Record<number, any[]> = {};
  allStudents.forEach(student => {
    if (!studentsBySection[student.sectionId]) {
      studentsBySection[student.sectionId] = [];
    }
    studentsBySection[student.sectionId].push(student);
  });

  return (
    <AttendanceClient 
      assignedSections={assignments} 
      studentsBySection={studentsBySection} 
    />
  );
}
