import { db } from "@/db";
import { campuses, classes, sections, students } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentsClient } from "./StudentsClient";
import { StudentRequestsClient } from "./StudentRequestsClient";
import { studentProfileChangeRequests } from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function StudentsPage({ searchParams }: { searchParams: { page?: string, limit?: string } }) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");
  
  const institutionId = session.institutionId || session.userId;
  const page = parseInt(searchParams.page || "1") || 1;
  const limit = parseInt(searchParams.limit || "50") || 50;
  const offset = (page - 1) * limit;

  const [allCampuses, allClasses, allSections, allStudents, totalCountResult, requests] = await Promise.all([
    db.select().from(campuses).where(eq(campuses.institutionId, institutionId)),
    db.select().from(classes).where(eq(classes.institutionId, institutionId)),
    db.select().from(sections).where(eq(sections.institutionId, institutionId)),
    db.select({
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
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(eq(students.institutionId, institutionId)),
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
  ]);

  const totalCount = totalCountResult[0].value;

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="directory">Student Directory</TabsTrigger>
          <TabsTrigger value="requests">Student Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <StudentsClient 
            students={allStudents}
            campuses={allCampuses}
            classes={allClasses}
            sections={allSections}
            totalCount={totalCount}
            page={page}
            limit={limit}
          />
        </TabsContent>

        <TabsContent value="requests">
          <StudentRequestsClient
            requests={requests.map((request) => ({
              ...request,
              requestedFields: request.requestedFields as Record<string, string | number>,
              createdAt: request.createdAt.toISOString(),
            }))}
            classes={allClasses}
            sections={allSections}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
