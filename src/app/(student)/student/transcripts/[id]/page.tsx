import { db } from '@/db';
import { institutions } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getStudentBatchReports } from '@/lib/batch-exams';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BatchResultReport } from '@/components/institution/BatchResultReport';
import { PrintButton } from './PrintButton';

export default async function TranscriptDetailsPage({ params }: { params: Promise<{id: string}> }) {
  const session = await getSession();
  if (!session || session.role !== 'STUDENT' || !session.institutionId) redirect('/login');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const [[report], [institution]] = await Promise.all([
    getStudentBatchReports(session.institutionId, session.userId, id),
    db.select({ name: institutions.name, logoKey: institutions.logoKey, signatureKey: institutions.signatureKey }).from(institutions).where(eq(institutions.id, session.institutionId)).limit(1),
  ]);
  if (!report || !institution) notFound();
  return <div className="mx-auto max-w-4xl space-y-5 pb-10">
    <div className="flex justify-between print:hidden"><Button variant="outline" asChild><Link href="/student/transcripts">Back to transcripts</Link></Button><PrintButton /></div>
    <BatchResultReport title={report.title} student={report.student} institution={institution} version={report.version} published grading={report.grading} />
  </div>;
}
