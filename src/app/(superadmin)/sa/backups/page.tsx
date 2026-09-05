import { db } from '@/db';
import { institutions } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { InstitutionBackupsClient } from './InstitutionBackupsClient';

export const dynamic = 'force-dynamic';

export default async function InstitutionBackupsPage({ searchParams }: { searchParams: Promise<{ institutionId?: string }> }) {
  const query = await searchParams;
  const initialInstitutionId = Number.parseInt(query.institutionId || '', 10);
  const schools = await db.select({ id: institutions.id, name: institutions.name, username: institutions.username })
    .from(institutions).orderBy(asc(institutions.name)).limit(2000);
  return <div className="space-y-8 animate-fade-in">
    <div>
      <h1 className="text-3xl font-display font-bold text-brand-950">Institution Backups</h1>
      <p className="mt-1 max-w-3xl leading-6 text-stone-500">Create, verify and retrieve isolated versions for any institution. Daily versions are retained for 30 days and monthly versions for one year.</p>
    </div>
    <InstitutionBackupsClient institutions={schools} initialInstitutionId={Number.isInteger(initialInstitutionId) ? initialInstitutionId : undefined} />
  </div>;
}

