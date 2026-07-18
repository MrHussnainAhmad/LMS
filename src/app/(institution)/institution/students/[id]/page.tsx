import { db } from "@/db";
import { students, classes, sections, attendances, marks, tests, submissions, assignments, batchExams, batchExamSubjects, batchExamResults, feeVouchers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, User, BookOpen, CheckCircle, FileText, Award, Receipt } from "lucide-react";
import Link from "next/link";
import { PrintButton } from "./PrintButton";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { ResultsTabs } from "./ResultsTabs";
import { SubmissionsList } from "./SubmissionsList";
import { StudentAnalytics } from "./StudentAnalytics";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");

  const { id } = await params;
  const studentId = parseInt(id);
  const institutionId = session.institutionId || session.userId;

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

  const [attendanceRecords, marksRecords, submissionRecords, rawBatchResults, studentVouchers] = await Promise.all([
    db.select()
      .from(attendances)
      .where(and(eq(attendances.studentId, studentId), eq(attendances.institutionId, institutionId)))
      .orderBy(desc(attendances.date))
      .limit(30),
    db.select({
      id: marks.id,
      marksObtained: marks.marksObtained,
      totalMarks: marks.totalMarks,
      testTitle: tests.title,
      date: tests.date,
      testType: tests.type,
    })
      .from(marks)
      .innerJoin(tests, eq(marks.testId, tests.id))
      .where(and(eq(marks.studentId, studentId), eq(marks.institutionId, institutionId)))
      .orderBy(desc(tests.date)),
    db.select({
      id: submissions.id,
      fileKey: submissions.fileKey,
      createdAt: submissions.createdAt,
      assignmentTitle: assignments.title,
      dueAt: assignments.dueAt,
    })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(and(eq(submissions.studentId, studentId), eq(submissions.institutionId, institutionId)))
      .orderBy(desc(submissions.createdAt)),
    db.select({
      examId: batchExams.id,
      examTitle: batchExams.title,
      examCreatedAt: batchExams.createdAt,
      subjectId: batchExamSubjects.id,
      isPublished: batchExamSubjects.isPublished,
      reviewDeadline: batchExamSubjects.reviewDeadline,
      maxMarks: batchExamSubjects.maxMarks,
      marksObtained: batchExamResults.marksObtained,
    })
      .from(batchExamResults)
      .innerJoin(batchExamSubjects, eq(batchExamResults.batchExamSubjectId, batchExamSubjects.id))
      .innerJoin(batchExams, eq(batchExamSubjects.batchExamId, batchExams.id))
      .where(and(eq(batchExamResults.studentId, studentId), eq(batchExams.institutionId, institutionId))),
    db.select()
      .from(feeVouchers)
      .where(and(eq(feeVouchers.studentId, studentId), eq(feeVouchers.institutionId, institutionId)))
      .orderBy(desc(feeVouchers.createdAt))
  ]);

  const examMap = new Map<number, { id: number, title: string, createdAt: Date, totalMax: number, totalObtained: number, percentage: number, isEffectivelyPublished: boolean }>();
  const now = new Date();
  
  for (const r of rawBatchResults) {
    if (!examMap.has(r.examId)) {
      examMap.set(r.examId, {
        id: r.examId,
        title: r.examTitle,
        createdAt: r.examCreatedAt,
        totalMax: 0,
        totalObtained: 0,
        percentage: 0,
        isEffectivelyPublished: true // will be set to false if any subject is not published
      });
    }
    
    const exam = examMap.get(r.examId)!;
    const isEffectivelyPublished = r.isPublished || now > r.reviewDeadline;
    
    if (!isEffectivelyPublished) {
      exam.isEffectivelyPublished = false;
    }
    
    exam.totalMax += r.maxMarks;
    exam.totalObtained += r.marksObtained;
  }

  const publishedBatchExams = Array.from(examMap.values())
    .filter(exam => exam.isEffectivelyPublished)
    .map(exam => ({
      ...exam,
      percentage: exam.totalMax > 0 ? Math.round((exam.totalObtained / exam.totalMax) * 100) : 0
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
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

        {publishedBatchExams.length > 0 && (
          <Card>
            <CardHeader className="bg-stone-50/50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" /> Term Results
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publishedBatchExams.map((exam) => (
                  <div key={exam.id} className="p-4 border border-stone-200 rounded-lg flex flex-col gap-2 bg-white">
                    <h4 className="font-semibold text-stone-800 line-clamp-1" title={exam.title}>{exam.title}</h4>
                    <p className="text-xs text-stone-500">{new Date(exam.createdAt).toLocaleDateString()}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-stone-700">{exam.totalObtained} / {exam.totalMax}</span>
                      <span className={`text-sm font-bold ${exam.percentage >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>{exam.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

        {studentVouchers.length > 0 && (
          <Card>
            <CardHeader className="bg-stone-50/50 py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" /> Fee Vouchers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {studentVouchers.map((v) => (
                  <div key={v.id} className="border border-border rounded-lg overflow-hidden flex flex-col bg-white">
                    <div className="h-40 bg-stone-100 relative group overflow-hidden">
                      <img src={v.imageUrl} alt={v.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <a 
                        href={v.imageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <span className="bg-white text-stone-900 text-sm font-medium px-3 py-1.5 rounded-md">View Full Image</span>
                      </a>
                    </div>
                    <div className="p-3">
                      <h4 className="font-semibold text-brand-950 truncate">{v.title}</h4>
                      <p className="text-xs text-stone-500 mt-1">Uploaded on {v.createdAt.toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
