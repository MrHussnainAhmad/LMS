/* eslint-disable @next/next/no-img-element -- Print documents load institution assets directly. */
import type { getBatchExamReport } from '@/lib/batch-exams';

type Report = Awaited<ReturnType<typeof getBatchExamReport>>;
export function BatchResultReport({ student, title, institution, version, published, grading }: {
  student: Report['students'][number]; title: string;
  institution: {name: string; logoKey: string | null; signatureKey: string | null};
  version: number; published: boolean; grading: Report['grading'];
}) {
  return <article className="print-document space-y-6 rounded-lg border border-border bg-white p-5 shadow-sm sm:p-8 print:break-after-page print:rounded-none print:border-0 print:p-0 print:shadow-none">
    <header className="flex items-center justify-between gap-4 border-b-2 border-brand-900 pb-5">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-brand-800">{institution.name}</p><h1 className="mt-1 font-display text-2xl font-bold text-brand-950">{title}</h1><p className="mt-1 text-xs text-stone-500">{published ? 'Official academic report' : 'DRAFT - Not yet published'} / Report version {version}</p></div>
      {institution.logoKey && <img src={institution.logoKey} alt={`${institution.name} logo`} className="h-16 w-16 object-contain" />}
    </header>
    <div className="grid grid-cols-2 gap-3 text-sm"><p><span className="text-stone-500">Student:</span> <strong>{student.name}</strong></p><p><span className="text-stone-500">Student ID:</span> {student.loginId}</p><p><span className="text-stone-500">Class:</span> {student.className}{student.sectionName ? ` / ${student.sectionName}` : ''}</p><p><span className="text-stone-500">Class roll:</span> {student.roll}</p></div>
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-y bg-stone-50"><tr><th className="p-2">Subject</th><th className="p-2 text-right">Maximum</th><th className="p-2 text-right">Marks / status</th><th className="p-2">Remark</th></tr></thead><tbody className="divide-y divide-border">
      {student.results.map(row => <tr key={row.subjectId}><td className="p-2">{row.subjectName}{row.components && <p className="text-xs text-stone-500">{Object.entries(row.components).map(([name, value]) => `${name}: ${value}`).join(' / ')}</p>}</td><td className="p-2 text-right">{row.status === 'EXEMPT' ? '-' : row.maxMarks}</td><td className="p-2 text-right font-medium">{row.status === 'MARKED' ? row.marks : row.status.replaceAll('_',' ')}{row.status === 'MARKED' && !row.passed && <span className="ml-1 text-xs">(below pass)</span>}</td><td className="p-2">{row.remark || '-'}</td></tr>)}
    </tbody><tfoot className="border-t-2 border-brand-900"><tr className="font-semibold"><td className="p-2">Total</td><td className="p-2 text-right">{student.totalMax}</td><td className="p-2 text-right">{student.totalObtained}</td><td className="p-2">{student.percentage}%</td></tr></tfoot></table></div>
    <div className="grid grid-cols-3 gap-3 rounded-md bg-stone-50 p-4 text-sm"><p>Overall<strong className="mt-1 block text-lg">{student.overallPercentage}%</strong></p><p>Grade<strong className="mt-1 block text-lg">{student.grade}</strong></p><p>Result<strong className="mt-1 block text-lg">{student.result}</strong></p></div>
    {student.attendance && <p className="text-sm">Attendance: {student.attendance.present}/{student.attendance.total} days ({student.attendance.total ? Math.round(student.attendance.present / student.attendance.total * 100) : 0}%)</p>}
    <p className="text-xs text-stone-500">Absent counts as zero; exempt subjects are excluded from totals. Pending and withheld results require institution review. Passing threshold: {grading.passingPercentage}% plus any subject requirements.</p>
    <footer className="flex flex-wrap items-end justify-between gap-6 pt-4"><div className="max-w-md text-xs text-stone-500"><p className="mb-1 font-semibold text-stone-700">Institution grading scale</p><p>{grading.grades.map(grade => `${grade.letter}: ${grade.min}-${grade.max}%`).join(' / ')}</p></div><div className="min-w-40 text-center">{institution.signatureKey && <img src={institution.signatureKey} alt="Head signature" className="mx-auto h-14 w-40 object-contain" />}<p className="border-t border-stone-400 pt-2 text-xs text-stone-600">Principal / Head</p></div></footer>
  </article>;
}
