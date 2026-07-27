"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, CheckCircle, FileText, Award, Receipt, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { ResultsTabs } from "./ResultsTabs";
import { SubmissionsList } from "./SubmissionsList";
import { StudentAnalytics } from "./StudentAnalytics";

type HistorySection = "attendance" | "marks" | "submissions" | "batchExams" | "vouchers" | "analytics";

type AttendanceRow = { id: number; date: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" };
type MarksRow = {
  id: number;
  marksObtained: number;
  totalMarks: number;
  testTitle: string;
  date: string;
  testType: string;
};
type SubmissionRow = {
  id: number;
  fileKey: string;
  createdAt: string;
  assignmentTitle: string;
  dueAt: string;
};
type BatchExamRow = {
  id: number;
  title: string;
  createdAt: string;
  totalMax: number;
  totalObtained: number;
  percentage: number;
};
type VoucherRow = {
  id: number;
  title: string;
  imageUrl: string;
  billingMonth: string | null;
  lateFeeAmount: number;
  createdAt: string;
};
type VoucherCycle = {
  status: "DUE" | "LATE" | "SUBMITTED";
  lateFeeAmount: number;
  submittedAt: string | null;
};
type AnalyticsData = {
  attendances: { date: string; status: string }[];
  marks: { date: string; marksObtained: number; totalMarks: number }[];
  submissions: { createdAt: string }[];
};

const HISTORY_SECTIONS: HistorySection[] = ["attendance", "marks", "submissions", "batchExams", "vouchers", "analytics"];

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function SectionShell({
  title,
  icon,
  loaded,
  loading,
  error,
  onLoad,
  children,
}: {
  title: string;
  icon: ReactNode;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="bg-stone-50/50 py-3 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {false && !loaded && (
          <Button type="button" size="sm" variant="outline" onClick={onLoad} disabled={loading}>
            {loading ? "Loading…" : "Load"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {!loaded && !error && !loading && (
          <p className="text-sm text-stone-500">Click Load to fetch this section.</p>
        )}
        {loading && <p className="text-sm text-stone-500">Loading…</p>}
        {loaded && children}
      </CardContent>
    </Card>
  );
}

export function StudentDetailHistory({ studentId }: { studentId: number }) {
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [marks, setMarks] = useState<MarksRow[] | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[] | null>(null);
  const [batchExams, setBatchExams] = useState<BatchExamRow[] | null>(null);
  const [vouchers, setVouchers] = useState<VoucherRow[] | null>(null);
  const [voucherCycle, setVoucherCycle] = useState<VoucherCycle | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState<Partial<Record<HistorySection, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<HistorySection, string>>>({});
  const requestVersion = useRef(0);

  const loadSection = useCallback(async (section: HistorySection, selectedMonth: string, version: number) => {
    setLoading((prev) => ({ ...prev, [section]: true }));
    setErrors((prev) => ({ ...prev, [section]: undefined }));
    try {
      const data = await api.get<Record<string, unknown>>(
        `/api/institution/students/${studentId}/history?section=${section}&month=${selectedMonth}`
      );
      if (version !== requestVersion.current) return;
      if (section === "attendance") setAttendance(data.attendance as AttendanceRow[]);
      if (section === "marks") setMarks(data.marks as MarksRow[]);
      if (section === "submissions") setSubmissions(data.submissions as SubmissionRow[]);
      if (section === "batchExams") setBatchExams(data.batchExams as BatchExamRow[]);
      if (section === "vouchers") {
        setVouchers(data.vouchers as VoucherRow[]);
        setVoucherCycle((data.voucherCycle as VoucherCycle | null) ?? null);
      }
      if (section === "analytics") setAnalytics(data.analytics as AnalyticsData);
    } catch {
      if (version === requestVersion.current) {
        setErrors((prev) => ({ ...prev, [section]: "Could not load this section." }));
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading((prev) => ({ ...prev, [section]: false }));
      }
    }
  }, [studentId]);

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    queueMicrotask(() => {
      if (version !== requestVersion.current) return;
      for (const section of HISTORY_SECTIONS) {
        void loadSection(section, month, version);
      }
    });

    return () => {
      if (requestVersion.current === version) requestVersion.current += 1;
    };
  }, [loadSection, month]);

  return (
    <div className="space-y-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-stone-50/50 px-4 py-3">
        <div>
          <h2 className="font-semibold text-brand-950">Student activity</h2>
          <p className="text-sm text-stone-500">Only the selected month is loaded.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          Month
          <input type="month" value={month} max={currentMonthValue()} onChange={(event) => setMonth(event.target.value)} className="rounded-md border border-border bg-white px-2 py-1.5" />
        </label>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionShell
          title="Recent Attendance"
          icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          loaded={attendance !== null}
          loading={Boolean(loading.attendance)}
          error={errors.attendance ?? null}
          onLoad={() => loadSection("attendance", month, requestVersion.current)}
        >
          <AttendanceCalendar records={attendance || []} monthValue={month} onMonthChange={setMonth} />
        </SectionShell>

        <SectionShell
          title="Recent Results"
          icon={<BookOpen className="h-5 w-5 text-blue-600" />}
          loaded={marks !== null}
          loading={Boolean(loading.marks)}
          error={errors.marks ?? null}
          onLoad={() => loadSection("marks", month, requestVersion.current)}
        >
          <ResultsTabs records={marks || []} />
        </SectionShell>
      </div>

      <SectionShell
        title="Term Results"
        icon={<Award className="h-5 w-5 text-amber-500" />}
        loaded={batchExams !== null}
        loading={Boolean(loading.batchExams)}
        error={errors.batchExams ?? null}
        onLoad={() => loadSection("batchExams", month, requestVersion.current)}
      >
        {(batchExams?.length ?? 0) === 0 ? (
          <p className="text-sm text-stone-500">No published term results.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchExams!.map((exam) => (
              <div key={exam.id} className="p-4 border border-stone-200 rounded-lg flex flex-col gap-2 bg-white">
                <h4 className="font-semibold text-stone-800 line-clamp-1" title={exam.title}>{exam.title}</h4>
                <p className="text-xs text-stone-500">{new Date(exam.createdAt).toLocaleDateString()}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">{exam.totalObtained} / {exam.totalMax}</span>
                  <span className={`text-sm font-bold ${exam.percentage >= 50 ? "text-emerald-600" : "text-red-600"}`}>
                    {exam.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      <SectionShell
        title="Assignment Submissions"
        icon={<FileText className="h-5 w-5 text-purple-600" />}
        loaded={submissions !== null}
        loading={Boolean(loading.submissions)}
        error={errors.submissions ?? null}
        onLoad={() => loadSection("submissions", month, requestVersion.current)}
      >
        <SubmissionsList records={submissions || []} />
      </SectionShell>

      <SectionShell
        title="Fee Vouchers"
        icon={<Receipt className="h-5 w-5 text-emerald-600" />}
        loaded={vouchers !== null}
        loading={Boolean(loading.vouchers)}
        error={errors.vouchers ?? null}
        onLoad={() => loadSection("vouchers", month, requestVersion.current)}
      >
        <div className="space-y-4">
          {voucherCycle && (
            <div className={`rounded-md border px-4 py-3 text-sm ${
              voucherCycle.status === "LATE"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : voucherCycle.status === "SUBMITTED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-blue-200 bg-blue-50 text-blue-950"
            }`}>
              <strong>{voucherCycle.status === "LATE" ? "Overdue" : voucherCycle.status === "SUBMITTED" ? "Submitted" : "Awaiting submission"}</strong>
              {voucherCycle.lateFeeAmount > 0 && (
                <span> · Late fee: PKR {voucherCycle.lateFeeAmount.toLocaleString("en-PK")}</span>
              )}
            </div>
          )}

          {(vouchers?.length ?? 0) === 0 ? (
            <p className="text-sm text-stone-500">
              {voucherCycle?.status === "LATE" ? "No voucher submitted for this month." : "No fee vouchers."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vouchers!.map((voucher) => (
                <div key={voucher.id} className="border border-border rounded-lg overflow-hidden flex flex-col bg-white">
                  <div className="h-40 bg-stone-100 relative group overflow-hidden">
                    <img
                      src={voucher.imageUrl}
                      alt={voucher.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <a
                      href={voucher.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <span className="bg-white text-stone-900 text-sm font-medium px-3 py-1.5 rounded-md">View Full Image</span>
                    </a>
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-brand-950 truncate">{voucher.title}</h4>
                    <p className="text-xs text-stone-500 mt-1">
                      Uploaded on {new Date(voucher.createdAt).toLocaleDateString()}
                    </p>
                    {voucher.lateFeeAmount > 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        Late fee: PKR {voucher.lateFeeAmount.toLocaleString("en-PK")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionShell>

      <SectionShell
        title="Analytics"
        icon={<Activity className="h-5 w-5 text-brand-600" />}
        loaded={analytics !== null}
        loading={Boolean(loading.analytics)}
        error={errors.analytics ?? null}
        onLoad={() => loadSection("analytics", month, requestVersion.current)}
      >
        <StudentAnalytics data={analytics!} month={month} />
      </SectionShell>
    </div>
  );
}
