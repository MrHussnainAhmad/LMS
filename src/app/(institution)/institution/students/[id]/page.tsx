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
    yearOfJoining: students.yearOfJoining,
    phone: students.phone,
    age: students.age,
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

  // Fetch Marks
  const marksRecords = await db.select({
    id: marks.id,
    marksObtained: marks.marksObtained,
    totalMarks: marks.totalMarks,
    testTitle: tests.title,
    date: tests.date,
  })
    .from(marks)
    .innerJoin(tests, eq(marks.testId, tests.id))
    .where(eq(marks.studentId, studentId))
    .orderBy(desc(tests.date))
    .limit(20);

  // Fetch Submissions
  const submissionRecords = await db.select({
    id: submissions.id,
    fileKey: submissions.fileKey,
    createdAt: submissions.createdAt,
    assignmentTitle: assignments.title,
  })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(submissions.createdAt))
    .limit(20);

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
            <div className="h-16 w-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center">
              <User className="h-8 w-8" />
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
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Age</p>
                <p className="mt-1 text-stone-800">{student.age || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Phone</p>
                <p className="mt-1 text-stone-800">{student.phone || 'N/A'}</p>
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
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-100 text-stone-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendanceRecords.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-4 text-center text-stone-500">No records found.</td></tr>
                  )}
                  {attendanceRecords.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                          r.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Marks */}
          <Card>
            <CardHeader className="bg-stone-50/50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" /> Recent Results
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-100 text-stone-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Test</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {marksRecords.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-stone-500">No records found.</td></tr>
                  )}
                  {marksRecords.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium">{r.testTitle}</td>
                      <td className="px-4 py-2">{r.date}</td>
                      <td className="px-4 py-2 font-mono">
                        {r.marksObtained} / {r.totalMarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Assignment</th>
                  <th className="px-4 py-2 font-medium">Submitted On</th>
                  <th className="px-4 py-2 font-medium">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissionRecords.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-center text-stone-500">No records found.</td></tr>
                )}
                {submissionRecords.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.assignmentTitle}</td>
                    <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono text-xs text-blue-600 truncate max-w-[200px]">
                      {r.fileKey}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
