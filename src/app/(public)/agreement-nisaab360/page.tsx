import { db } from '@/db';
import { institutions, institutionAgreementAcceptances } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PrintButton } from './PrintButton';
import { BackButton } from './BackButton';
import { getPublicPricingPlans, getInstitutionPricingPlan } from '@/lib/pricing';
import { connection } from 'next/server';
import { SERVICE_AGREEMENT_VERSION, SERVICE_AGREEMENT_INTRODUCTION, SERVICE_AGREEMENT_SECTIONS, type ServiceAgreementSnapshot } from '@/lib/service-agreement';

export default async function AgreementPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  await connection();
  let instName = '_________________________________';
  let instLocation = '______________________________________________________';
  let isFilled = false;
  const publicPlan = typeof params.plan === 'string' ? (await getPublicPricingPlans()).find(plan => plan.id === String(params.plan).toUpperCase()) : undefined;
  let selectedPlan: ServiceAgreementSnapshot['plan'] | undefined = publicPlan ? { ...publicPlan, definition: publicPlan } : undefined;
  let sections: readonly { title: string; content: string }[] = SERVICE_AGREEMENT_SECTIONS;
  let version: string = SERVICE_AGREEMENT_VERSION;
  let introduction: string = SERVICE_AGREEMENT_INTRODUCTION;
  let acceptance: { acceptedAt: Date; representativeName: string; contactEmail: string } | null = null;

  if (params.id !== undefined) {
    if (typeof params.id !== 'string' || !/^[1-9]\d*$/.test(params.id)) notFound();
    const institutionId = Number(params.id);
    if (!Number.isSafeInteger(institutionId)) notFound();
    const session = await getSession();
    const platformAccess = session?.role === 'SUPER_ADMIN' || session?.role === 'EMPLOYEE';
    const institutionAccess = (session?.role === 'INSTITUTION' || session?.role === 'INSTITUTION_ADMIN') && session.institutionId === institutionId;
    if (!platformAccess && !institutionAccess) notFound();

    const [institution] = await db.select({
      name: institutions.name, address: institutions.address, city: institutions.city,
      country: institutions.country, pricingPlan: institutions.pricingPlan,
    }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);
    if (!institution) notFound();
    instName = institution.name;
    instLocation = `${institution.address}, ${institution.city}, ${institution.country}`;
    const assignedPlan = await getInstitutionPricingPlan(institutionId);
    selectedPlan = assignedPlan ? { ...assignedPlan, definition: assignedPlan } : undefined;
    isFilled = true;

    const [record] = await db.select({
      snapshot: institutionAgreementAcceptances.snapshot,
      acceptedAt: institutionAgreementAcceptances.acceptedAt,
      representativeName: institutionAgreementAcceptances.representativeName,
      contactEmail: institutionAgreementAcceptances.contactEmail,
    }).from(institutionAgreementAcceptances).where(eq(institutionAgreementAcceptances.institutionId, institutionId)).limit(1);
    if (record) {
      acceptance = record;
      const snapshot = record.snapshot;
      instName = snapshot.institution.name;
      instLocation = `${snapshot.institution.address}, ${snapshot.institution.city}, ${snapshot.institution.country}`;
      selectedPlan = snapshot.plan;
      sections = snapshot.sections;
      version = snapshot.version;
      introduction = snapshot.introduction;
    }
  }

  return (
    <div className="public-document min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8 print:bg-white print:px-0 print:py-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 print:hidden">
          {isFilled ? <BackButton /> : <div />}
          <PrintButton title={isFilled ? `${instName} and Nisaab360` : 'Nisaab360 Service Agreement'} />
        </div>
        <div className="print-document border border-border bg-surface p-5 sm:p-10 lg:p-12 print:border-none print:bg-white print:p-0">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold font-serif mb-2">SERVICE AGREEMENT</h1>
            <p className="text-stone-600 font-serif">Between Nisaab360 and {isFilled ? instName : 'Institution'}</p>
            <p className="mt-2 text-sm text-stone-600">Institution address: {instLocation}</p>
            <p className="mt-2 text-xs text-stone-500">Version {version}</p>
          </div>
          <div className="space-y-6 font-serif text-stone-800 leading-relaxed text-justify">
            <p>{introduction}</p>
            {acceptance ? (
              <div className="border border-stone-300 p-4 text-left text-sm">
                <p><strong>Electronic acceptance recorded</strong></p>
                <p>Representative: {acceptance.representativeName}</p>
                <p>Registered contact: {acceptance.contactEmail}</p>
                <p>Accepted at: {acceptance.acceptedAt.toISOString()} (UTC)</p>
                <p>This copy preserves the agreement and advertised plan pricing recorded at registration. Separately agreed written commercial terms apply as described below.</p>
              </div>
            ) : isFilled ? (
              <p className="border border-stone-300 p-4 text-left text-sm">Current agreement template. No electronic acceptance of this version is recorded for this institution.</p>
            ) : null}
            <section className="space-y-4">
              <h2 className="text-lg font-bold">1. Selected Plan and Advertised Pricing</h2>
              {selectedPlan ? (
                <div className="border border-stone-300 p-4 text-left">
                  <p><strong>{selectedPlan.name}</strong> — {selectedPlan.audience}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><span className="block text-xs uppercase tracking-wide text-stone-500">One-time setup</span><strong>{selectedPlan.setup}</strong></div>
                    <div><span className="block text-xs uppercase tracking-wide text-stone-500">Subscription fee</span><strong>{selectedPlan.monthly}</strong><span className="block text-sm text-stone-600">{selectedPlan.monthlyDetail}</span></div>
                  </div>
                  <p className="mt-3 text-sm text-stone-600">{selectedPlan.scale} · {selectedPlan.campusDetail}</p>
                  {selectedPlan.definition ? <p className="mt-3 text-sm">Platform access: {selectedPlan.definition.platforms.join(', ')}</p> : null}
                  {selectedPlan.id === 'ENTERPRISE' ? <p className="mt-3 text-sm">Final Enterprise pricing and billing quantities require a written quotation accepted before activation.</p> : null}
                </div>
              ) : <p>Select a pricing plan during registration. Enterprise or other individually negotiated charges must be confirmed in writing before activation.</p>}
            </section>
            {sections.map((section, index) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-bold">{index + 2}. {section.title}</h2>
                <p>{section.content}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
