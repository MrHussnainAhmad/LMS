import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  assignments,
  attendances,
  feeInvoices,
  feePayments,
  feePaymentSubmissions,
  marks,
  students,
  submissions,
  tests,
} from "@/db/schema";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { singleMonthRange } from "@/lib/month-window";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getStudentBatchReports } from '@/lib/batch-exams';

type HistorySection = "attendance" | "marks" | "submissions" | "batchExams" | "fees" | "analytics";

const VALID_SECTIONS = new Set<HistorySection>([
  "attendance",
  "marks",
  "submissions",
  "batchExams",
  "fees",
  "analytics",
]);

async function loadAttendance(studentId: number, institutionId: number, from: string, to: string) {
  return db
    .select({
      id: attendances.id,
      date: attendances.date,
      status: attendances.status,
    })
    .from(attendances)
    .where(
      and(
        eq(attendances.studentId, studentId),
        eq(attendances.institutionId, institutionId),
        gte(attendances.date, from),
        lte(attendances.date, to)
      )
    )
    .orderBy(desc(attendances.date));
}

async function loadMarks(studentId: number, institutionId: number, from: string, to: string) {
  return db
    .select({
      id: marks.id,
      marksObtained: marks.marksObtained,
      totalMarks: marks.totalMarks,
      testTitle: tests.title,
      date: tests.date,
      testType: tests.type,
    })
    .from(marks)
    .innerJoin(tests, eq(marks.testId, tests.id))
    .where(
      and(
        eq(marks.studentId, studentId),
        eq(marks.institutionId, institutionId),
        gte(tests.date, from),
        lte(tests.date, to)
      )
    )
    .orderBy(desc(tests.date));
}

async function loadSubmissions(studentId: number, institutionId: number, from: string, to: string) {
  const rows = await db
    .select({
      id: submissions.id,
      fileKey: submissions.fileKey,
      createdAt: submissions.createdAt,
      assignmentTitle: assignments.title,
      dueAt: assignments.dueAt,
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(and(
      eq(submissions.studentId, studentId),
      eq(submissions.institutionId, institutionId),
      gte(submissions.createdAt, new Date(`${from}T00:00:00`)),
      lte(submissions.createdAt, new Date(`${to}T23:59:59.999`))
    ))
    .orderBy(desc(submissions.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
  }));
}

async function loadBatchExams(studentId: number, institutionId: number, from: string, to: string) {
  const reports = await getStudentBatchReports(institutionId, studentId);
  return reports.filter(report => {
    const day = report.createdAt.toISOString().slice(0, 10);
    return day >= from && day <= to;
  }).map(report => ({ id: report.id, title: report.title, createdAt: report.createdAt.toISOString(),
    totalMax: report.totalMax, totalObtained: report.totalObtained, percentage: report.percentage, isEffectivelyPublished: true }));
}

async function loadFees(studentId: number, institutionId: number, billingMonth: string) {
  const [invoice] = await db
    .select()
    .from(feeInvoices)
    .where(and(
      eq(feeInvoices.studentId, studentId),
      eq(feeInvoices.institutionId, institutionId),
      eq(feeInvoices.billingMonth, billingMonth),
    ))
    .limit(1);

  if (!invoice) return { feeAccount: null };

  const [payments, paymentSubmissions] = await Promise.all([
    db
      .select({
        id: feePayments.id,
        receiptNumber: feePayments.receiptNumber,
        amount: feePayments.amount,
        method: feePayments.method,
        reference: feePayments.reference,
        receivedAt: feePayments.receivedAt,
      })
      .from(feePayments)
      .where(and(
        eq(feePayments.institutionId, institutionId),
        eq(feePayments.studentId, studentId),
        eq(feePayments.invoiceId, invoice.id),
      ))
      .orderBy(desc(feePayments.receivedAt)),
    db
      .select({
        id: feePaymentSubmissions.id,
        amount: feePaymentSubmissions.amount,
        sourceBankName: feePaymentSubmissions.sourceBankName,
        transactionId: feePaymentSubmissions.transactionId,
        status: feePaymentSubmissions.status,
        reviewerNote: feePaymentSubmissions.reviewerNote,
        submittedAt: feePaymentSubmissions.submittedAt,
      })
      .from(feePaymentSubmissions)
      .where(and(
        eq(feePaymentSubmissions.institutionId, institutionId),
        eq(feePaymentSubmissions.studentId, studentId),
        eq(feePaymentSubmissions.invoiceId, invoice.id),
      ))
      .orderBy(desc(feePaymentSubmissions.submittedAt)),
  ]);

  return {
    feeAccount: {
      invoice: {
        ...invoice,
        createdAt: invoice.createdAt.toISOString(),
        updatedAt: invoice.updatedAt.toISOString(),
      },
      payments: payments.map((payment) => ({
        ...payment,
        receivedAt: payment.receivedAt.toISOString(),
      })),
      submissions: paymentSubmissions.map((submission) => ({
        ...submission,
        submittedAt: submission.submittedAt.toISOString(),
      })),
    },
  };
}

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const studentId = parseInt(id, 10);
  const institutionId = getTenantContext(session);
  const section = req.nextUrl.searchParams.get("section") as HistorySection | null;
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  if (isNaN(studentId) || !section || !VALID_SECTIONS.has(section) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.institutionId, institutionId)))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { from, to } = singleMonthRange(new Date(`${month}-01T00:00:00`));

  if (section === "attendance") {
    return NextResponse.json({ attendance: await loadAttendance(studentId, institutionId, from, to) });
  }

  if (section === "marks") {
    return NextResponse.json({ marks: await loadMarks(studentId, institutionId, from, to) });
  }

  if (section === "submissions") {
    return NextResponse.json({ submissions: await loadSubmissions(studentId, institutionId, from, to) });
  }

  if (section === "batchExams") {
    return NextResponse.json({ batchExams: await loadBatchExams(studentId, institutionId, from, to) });
  }

  if (section === "fees") {
    return NextResponse.json(await loadFees(studentId, institutionId, month));
  }

  // analytics: combine the datasets the chart needs
  const [attendance, marksRows, submissionRows, batchExamRows] = await Promise.all([
    loadAttendance(studentId, institutionId, from, to),
    loadMarks(studentId, institutionId, from, to),
    loadSubmissions(studentId, institutionId, from, to),
    loadBatchExams(studentId, institutionId, from, to),
  ]);

  return NextResponse.json({
    analytics: {
      attendances: attendance,
      marks: [
        ...marksRows.map((row) => ({
          date: row.date,
          marksObtained: row.marksObtained,
          totalMarks: row.totalMarks,
        })),
        ...batchExamRows.map((exam) => ({
          date: exam.createdAt,
          marksObtained: exam.totalObtained,
          totalMarks: exam.totalMax,
        })),
      ],
      submissions: submissionRows.map((row) => ({ createdAt: row.createdAt })),
    },
  });
});
