import { db } from "@/db";
import { students, classes, sections, attendances, marks, tests, submissions, assignments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, User, BookOpen, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "./PrintButton";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { ResultsTabs } from "./ResultsTabs";
import { SubmissionsList } from "./SubmissionsList";
import { StudentAnalytics } from "./StudentAnalytics";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const { id } = await params;
  const studentId = parseInt(id);
  const institutionId = session.userId;

  if (isNaN(studentId)) redirect("/institution/students");

  // Fetch Student Profile
  const [student] = await db.select({
    id: students.id,
    name: students.name,
    gender: students.gender,
    loginRollNumber: students.loginRollNumber,
    classRollNumber: students.classRollNumber,
    profilePictureUrl: students.profilePictureUrl,
    emergencyContact: students.emergencyContact,
    parentalWhatsapp: students.parentalWhatsapp,
    yearOfJoining: students.yearOfJoining,
    className: classes.name,
    sectionName: sections.name,
  })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(sections, eq(students.sectionId, sections.id))
    .where(and(eq(students.id, studentId), eq(students.institutionId, institutionId)))
    .limit(1);

  if (!student) redirect("/institution/students");

  // Fetch Attendance
  const attendanceRecords = await db.select()
    .from(attendances)
    .where(eq(attendances.studentId, studentId))
    .orderBy(desc(attendances.date))
    .limit(30);

  const marksRecords = await db.select({
    id: marks.id,
    marksObtained: marks.marksObtained,
    totalMarks: marks.totalMarks,
    testTitle: tests.title,
    date: tests.date,
    testType: tests.type,
  })
    .from(marks)
    .innerJoin(tests, eq(marks.testId, tests.id))
    .where(eq(marks.studentId, studentId))
    .orderBy(desc(tests.date));

  // Fetch Submissions
  const submissionRecords = await db.select({
    id: submissions.id,
    fileKey: submissions.fileKey,
    createdAt: submissions.createdAt,
    assignmentTitle: assignments.title,
    dueAt: assignments.dueAt,
  })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(submissions.createdAt));

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Print-hidden header */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/institution/students" className="flex items-center text-sm text-stone-500 hover:text-brand-600 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Directory
        </Link>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Card */}
        <Card className="border-t-4 border-t-brand-600">
          <CardHeader className="bg-stone-50/50 flex flex-row items-center gap-4">
            <div className="h-16 w-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
              {student.profilePictureUrl ? (
                <img src={student.profilePictureUrl} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <User className="h-8 w-8" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl text-brand-950">{student.name}</CardTitle>
              <p className="text-stone-500 font-mono mt-1">{student.loginRollNumber}</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Class</p>
                <p className="mt-1 text-stone-800">{student.className} - {student.sectionName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Class Roll No.</p>
                <p className="mt-1 text-stone-800">{student.classRollNumber}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Gender</p>
                <p className="mt-1 text-stone-800">{student.gender}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Year of Joining</p>
                <p className="mt-1 text-stone-800">{student.yearOfJoining}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Emergency Contact</p>
                <p className="mt-1 text-stone-800">{student.emergencyContact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Parental Whatsapp</p>
                <p className="mt-1 text-stone-800">{student.parentalWhatsapp || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          {/* Attendance */}
          <Card>
            <CardHeader className="bg-stone-50/50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" /> Recent Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <AttendanceCalendar records={attendanceRecords as any} />
            </CardContent>
          </Card>

          {/* Marks */}
          <Card>
            <CardHeader className="bg-stone-50/50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" /> Recent Results
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResultsTabs records={marksRecords} />
            </CardContent>
          </Card>
        </div>

        {/* Submissions */}
        <Card>
          <CardHeader className="bg-stone-50/50 py-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" /> Assignment Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <SubmissionsList records={submissionRecords.map(s => ({
              ...s,
              createdAt: s.createdAt.toISOString(),
              dueAt: s.dueAt.toISOString()
            }))} />
          </CardContent>
        </Card>

        {/* Analytics Section */}
        <StudentAnalytics data={{
          attendances: attendanceRecords as any,
          marks: marksRecords,
          submissions: submissionRecords.map(s => ({ createdAt: s.createdAt.toISOString() }))
        }} />

      </div>
    </div>
  );
}
