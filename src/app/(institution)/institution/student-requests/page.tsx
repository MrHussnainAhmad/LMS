import { db } from "@/db";
import { classes, sections, studentProfileChangeRequests, students } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { StudentRequestsClient } from "./StudentRequestsClient";

export default async function InstitutionStudentRequestsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const institutionId = session.userId;

  const [requests, allClasses, allSections] = await Promise.all([
    db.select({
      id: studentProfileChangeRequests.id,
      requestedFields: studentProfileChangeRequests.requestedFields,
      reason: studentProfileChangeRequests.reason,
      status: studentProfileChangeRequests.status,
      adminNote: studentProfileChangeRequests.adminNote,
      createdAt: studentProfileChangeRequests.createdAt,
      studentId: students.id,
      studentName: students.name,
      rollNumber: students.classRollNumber,
      loginRollNumber: students.loginRollNumber,
      fatherName: students.fatherName,
      className: classes.name,
      sectionName: sections.name,
    })
      .from(studentProfileChangeRequests)
      .innerJoin(students, eq(studentProfileChangeRequests.studentId, students.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .innerJoin(sections, eq(students.sectionId, sections.id))
      .where(eq(studentProfileChangeRequests.institutionId, institutionId))
      .orderBy(desc(studentProfileChangeRequests.createdAt)),
    db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.institutionId, institutionId)),
    db.select({ id: sections.id, name: sections.name, classId: sections.classId }).from(sections).where(eq(sections.institutionId, institutionId)),
  ]);

  return (
    <StudentRequestsClient
      requests={requests.map((request) => ({
        ...request,
        requestedFields: request.requestedFields as Record<string, string | number>,
        createdAt: request.createdAt.toISOString(),
      }))}
      classes={allClasses}
      sections={allSections}
    />
  );
}
