import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { institutions } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getBatchExamReport } from '@/lib/batch-exams';
import { ActionInputError } from '@/lib/action-input-error';
import { BatchResultReport } from '@/components/institution/BatchResultReport';
import { PromotionReviewActions } from './PromotionReviewActions';

export default async function PromotionReviewPage({ params, searchParams }: {
  params: Promise<{id: string}>; searchParams: Promise<{version?: string; student?: string; mode?: string}>;
}) {
  const session = await getSession();
  if (!session || !['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role) || !session.institutionId) redirect('/institution-login');
  const id = Number((await params).id), query = await searchParams;
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  let report;
  try { report = await getBatchExamReport(session.institutionId, id, db, query.version ? Number(query.version) : undefined); }
  catch (err) { if (err instanceof ActionInputError) notFound(); throw err; }
  const [institution] = await db.select({ name: institutions.name, logoKey: institutions.logoKey, signatureKey: institutions.signatureKey }).from(institutions).where(eq(institutions.id, session.institutionId)).limit(1);
  if (!institution) notFound();
  const selected = query.student ? report.students.filter(student => student.id === Number(query.student)) : report.students;
  if (!selected.length) notFound();
  const subjectNames = report.subjects.map(subject => subject.name);
  const csvRows = selected.map(student => ({ roll: student.roll, student: student.name, total: student.totalObtained, percentage: student.overallPercentage, status: student.result,
    subjects: Object.fromEntries(student.results.map(row => [row.subjectName, row.status === 'MARKED' ? `${row.marks}/${row.maxMarks}` : row.status])) }));
  const cards = query.mode === 'cards' || Boolean(query.student);
  return <div className="print-document mx-auto max-w-7xl space-y-5 pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4 print:hidden"><div><h1 className="font-display text-2xl font-bold text-brand-950">{report.exam.title}</h1><p className="text-sm text-stone-500">{report.exam.className} / {report.exam.officialPublishedAt ? 'Published' : 'Private draft'} / Version {report.version}</p></div><PromotionReviewActions fileName={`exam-${id}-v${report.version}`} subjects={subjectNames} rows={csvRows} /></div>
    <div className="flex flex-wrap gap-4 text-sm print:hidden"><a className="text-brand-700 underline" href={`?version=${report.version}`}>Class review sheet</a><a className="text-brand-700 underline" href={`?mode=cards&version=${report.version}`}>Batch report cards</a>
      {Array.from({length: report.exam.settings.reportVersion ?? 1}, (_, index) => index + 1).map(version => <a key={version} href={`?version=${version}`} className="text-brand-700 underline">Version {version}</a>)}
    </div>
    {cards ? selected.map(student => <BatchResultReport key={student.id} student={student} title={report.exam.title} institution={institution} version={report.version} published={Boolean(report.exam.officialPublishedAt)} grading={report.grading} />) : <>
      <div className="rounded-lg border border-border bg-white p-4 text-sm"><strong>{institution.name}</strong><p>{report.statistics.students} students / {report.statistics.passed} passed / {report.statistics.failed} failed / {report.statistics.pending} pending / Class average {report.statistics.average}%</p></div>
      <div className="overflow-auto rounded-lg border border-border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-stone-50"><tr><th className="p-3">Student</th>{subjectNames.map(name => <th key={name} className="p-3">{name}</th>)}<th className="p-3">Total / Overall</th><th className="p-3">Grade / Result</th><th className="p-3 print:hidden">Report</th></tr></thead><tbody className="divide-y divide-border">
        {selected.map(student => <tr key={student.id}><td className="p-3">{student.roll} / {student.name}</td>{student.results.map(row => <td key={row.subjectId} className="p-3">{row.status === 'MARKED' ? `${row.marks}/${row.maxMarks}` : row.status.replaceAll('_',' ')}</td>)}<td className="p-3">{student.totalObtained}/{student.totalMax} / {student.overallPercentage}%</td><td className="p-3">{student.grade} / {student.result}</td><td className="p-3 print:hidden"><a className="text-brand-700 underline" href={`?student=${student.id}&version=${report.version}`}>Print card</a></td></tr>)}
      </tbody></table></div>
    </>}
  </div>;
}
