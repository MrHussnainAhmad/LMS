import { getTeacherPerformance } from '@/lib/teacher-performance';
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpen, CalendarRange, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherPerformancePanels } from "./TeacherPerformancePanels";

const PERIODS = [3, 6, 12] as const;

export default async function TeacherPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ months?: string }>;
}) {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");
  const institutionId = session.institutionId || session.userId;
  const staffId = Number((await params).id);
  if (!Number.isInteger(staffId) || staffId <= 0) notFound();
  const requestedMonths = Number((await searchParams).months || "6");
  const months = PERIODS.includes(requestedMonths as (typeof PERIODS)[number]) ? requestedMonths : 6;

  const performance = await getTeacherPerformance(institutionId, staffId, months);
  if (!performance) notFound();
  const { teacher, assignments, allPoints, overallAverage, performanceGroups } = performance;

  return (
    <div className="animate-fade-in space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/institution/staff" className="mb-4 inline-flex items-center text-sm font-semibold text-brand-700 hover:text-brand-950"><ArrowLeft className="mr-2 h-4 w-4" /> Staff directory</Link>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Teacher performance</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-brand-950">{teacher.name}</h1>
          <p className="mt-1 text-sm text-stone-500">{teacher.email} · {teacher.isActive ? "Active" : "Disabled"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((period) => <Link key={period} href={`/institution/staff/${staffId}/performance?months=${period}`} className={`rounded-md border px-3 py-2 text-sm font-semibold ${months === period ? "border-brand-800 bg-brand-800 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-brand-500"}`}>{period} months</Link>)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Teaching assignments" value={String(assignments.length)} icon={BookOpen} />
        <SummaryCard label="Published assessments" value={String(allPoints.length)} icon={CalendarRange} />
        <SummaryCard label="Overall class average" value={overallAverage === null ? "—" : `${overallAverage}%`} icon={BarChart3} />
      </div>

      {assignments.length === 0 ? (
        <Card><CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center"><Users className="mb-3 h-8 w-8 text-stone-400" /><h2 className="font-display text-xl font-semibold text-brand-950">No timetable assignments</h2><p className="mt-2 max-w-lg text-sm leading-6 text-stone-500">Assign this teacher to a section and subject in Timetable before performance can be attributed.</p></CardContent></Card>
      ) : (
        <TeacherPerformancePanels groups={performanceGroups} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-md bg-brand-100 p-3 text-brand-800"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-stone-500">{label}</p><p className="mt-1 font-display text-2xl font-bold text-brand-950">{value}</p></div></CardContent></Card>;
}
