import { db } from "@/db";
import { campuses, classes, sections, students } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentsClient } from "./StudentsClient";

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");
  
  const institutionId = session.userId;

  const allCampuses = await db.select().from(campuses).where(eq(campuses.institutionId, institutionId));
  const allClasses = await db.select().from(classes).where(eq(classes.institutionId, institutionId));
  const allSections = await db.select().from(sections).where(eq(sections.institutionId, institutionId));
  
  const allStudents = await db.select({
    id: students.id,
    loginRollNumber: students.loginRollNumber,
    name: students.name,
    gender: students.gender,
    yearOfJoining: students.yearOfJoining,
    classId: students.classId,
    sectionId: students.sectionId,
    classRollNumber: students.classRollNumber,
    phone: students.phone,
  })
    .from(students)
    .where(eq(students.institutionId, institutionId))
    .orderBy(desc(students.createdAt));

  return (
    <StudentsClient 
      students={allStudents}
      campuses={allCampuses}
      classes={allClasses}
      sections={allSections}
    />
  );
}
