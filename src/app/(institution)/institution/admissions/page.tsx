import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdmissionsManager } from './AdmissionsManager';
import { ApplicationsReviewPanel } from './ApplicationsReviewPanel';

const sections = [
  { key: 'setup', label: 'Admissions setup', description: 'New cycle and program or class' },
  { key: 'status', label: 'Open / close', description: 'Publish or close an admission cycle' },
  { key: 'review', label: 'Review applications', description: 'Process submitted applications' },
  { key: 'offline', label: 'Offline applications', description: 'Record walk-in applicants' },
] as const;

export default async function InstitutionAdmissionsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== 'INSTITUTION' && session.role !== 'INSTITUTION_ADMIN')) redirect('/login');
  const requestedSection = (await searchParams).section;
  const section = sections.some((item) => item.key === requestedSection) ? requestedSection : 'setup';

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Admissions</h1>
        <p className="mt-1 text-stone-500">Create an admission cycle, add available programs or classes, then open applications.</p>
      </div>
      <nav aria-label="Admissions sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((item) => <Link key={item.key} href={`/institution/admissions?section=${item.key}`} scroll={false} className={`rounded-xl border p-4 text-left transition ${section === item.key ? 'border-brand-600 bg-brand-950 text-white shadow-sm' : 'border-stone-200 bg-white text-stone-800 hover:border-brand-300'}`}><span className="block text-sm font-bold">{item.label}</span><span className={`mt-1 block text-xs leading-5 ${section === item.key ? 'text-white/70' : 'text-stone-500'}`}>{item.description}</span></Link>)}
      </nav>
      {section === 'setup' && <AdmissionsManager mode="setup" />}
      {section === 'status' && <AdmissionsManager mode="status" />}
      {section === 'review' && <ApplicationsReviewPanel />}
      {section === 'offline' && <ApplicationsReviewPanel offlineOnly />}
    </div>
  );
}
