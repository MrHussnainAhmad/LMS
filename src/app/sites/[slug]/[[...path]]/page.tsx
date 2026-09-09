import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  admissionApplicantAccounts,
  admissionEnrollments,
  admissionApplicationEvents,
  admissionApplications,
  admissionAppointments,
  admissionCycles,
  admissionDocumentRequests,
  admissionFeePayments,
  admissionOfferings,
  students,
} from "@/db/schema";
import {
  ADMISSION_SESSION_COOKIE,
  verifyAdmissionSessionToken,
} from "@/lib/admission-auth";
import {
  institutionPublicUrl,
  parseInstitutionHostname,
} from "@/lib/institution-domain";
import { resolveInstitutionTenant } from "@/lib/institution-tenant";
import { getPublishedPublicEvent, listPublishedPublicEvents } from "@/lib/public-event-queries";
import { getPublicSiteBaseDomain } from "@/lib/public-site-domain";
import type { PublicInstitutionTenant } from "@/lib/institution-tenant";
import { AdmissionsApplicationForm } from "./AdmissionsApplicationForm";
import { ApplicantLoginForm } from "./ApplicantLoginForm";
import { ApplicantChangePasswordForm } from "./ApplicantChangePasswordForm";
import { ApplicantLogoutButton } from "./ApplicantLogoutButton";
import { ApplicantDocumentUpload } from "./ApplicantDocumentUpload";
import { ApplicantFeePayment } from "./ApplicantFeePayment";
import { InstitutionHomepage } from "./InstitutionHomepage";
import { OfflineAdmissionForm } from "./OfflineAdmissionForm";
import { PublicEventPage } from "./PublicEventPage";

// Institution publication state is mutable and tenant slugs can be assigned
// after the first request. Never persist a pre-publication notFound() response
// in Next's full-route cache; the tenant resolver already has a short Valkey TTL.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TenantSitePageProps = {
  params: Promise<{ slug: string; path?: string[] }>;
};

async function getRequestTenant(slug: string) {
  const requestHeaders = await headers();
  const parsedHostname = parseInstitutionHostname(
    requestHeaders.get("host") || "",
    await getPublicSiteBaseDomain(),
  );
  if (parsedHostname.kind !== "institution" || parsedHostname.slug !== slug)
    return null;

  const resolution = await resolveInstitutionTenant(slug);
  return resolution.kind === "active" ? resolution.tenant : null;
}

async function getStudentLoginUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  const port = host.match(/:(\d+)$/)?.[1];
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1"
  ) {
    const protocol =
      requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
    return `${protocol}://localhost${port ? `:${port}` : ""}/login`;
  }
  return `https://${await getPublicSiteBaseDomain()}/login`;
}

export async function generateMetadata({
  params,
}: TenantSitePageProps): Promise<Metadata> {
  const { slug, path } = await params;
  const tenantRoute = path?.join("/") || "";
  const eventSlug = path?.length === 2 && (path[0] === "event" || path[0] === "events") ? path[1] : null;
  const isAdmissionsPage = tenantRoute === "admissions";
  const isApplicantRoute = [
    "admissions/login",
    "admissions/change-password",
    "admissions/portal",
  ].includes(tenantRoute);
  if (tenantRoute && !isAdmissionsPage && !isApplicantRoute && !eventSlug)
    return { title: "Page Not Found", robots: { index: false, follow: false } };

  const tenant = await getRequestTenant(slug);
  if (!tenant)
    return {
      title: "Institution Not Found",
      robots: { index: false, follow: false },
    };

  const publicEvent = eventSlug ? await getPublishedPublicEvent(tenant.id, eventSlug) : null;
  if (eventSlug && !publicEvent) return { title: "Event Not Found", robots: { index: false, follow: false } };

  const canonical = institutionPublicUrl(
    tenant.publicSlug,
    undefined,
    "https:",
    await getPublicSiteBaseDomain(),
  );
  const fallbackDescription = `${tenant.name}, a ${tenant.type.toLowerCase()} in ${tenant.city}, ${tenant.country}. View official institution information on Nisaab360.`;
  const description = tenant.description
    ? `${tenant.description.slice(0, 157)}${tenant.description.length > 157 ? "..." : ""}`
    : fallbackDescription;

  return {
    title: publicEvent
      ? `${publicEvent.title} | ${tenant.name}`
      : isAdmissionsPage
      ? `Admissions | ${tenant.name}`
      : isApplicantRoute
        ? `Applicant Portal | ${tenant.name}`
        : tenant.name,
    description: publicEvent?.summary || description,
    alternates: {
      canonical: publicEvent
        ? `${canonical}/event/${publicEvent.slug}`
        : isAdmissionsPage
        ? `${canonical}/admissions`
        : isApplicantRoute
          ? undefined
          : canonical,
    },
    openGraph: {
      title: publicEvent?.title || tenant.name,
      description: publicEvent?.summary || description,
      url: publicEvent ? `${canonical}/event/${publicEvent.slug}` : isAdmissionsPage ? `${canonical}/admissions` : canonical,
      siteName: tenant.name,
      type: "website",
      images: publicEvent?.coverImageUrl
        ? [{ url: publicEvent.coverImageUrl, alt: publicEvent.title }]
        : tenant.heroImageUrl
        ? [{ url: tenant.heroImageUrl, alt: tenant.tagline || tenant.name }]
        : tenant.logoKey.startsWith("http")
          ? [{ url: tenant.logoKey, alt: `${tenant.name} logo` }]
          : undefined,
    },
    robots: {
      index: isApplicantRoute
        ? false
        : !isAdmissionsPage || tenant.admissionsEnabled,
      follow: !isApplicantRoute,
    },
  };
}

export default async function TenantSitePage({ params }: TenantSitePageProps) {
  const { slug, path } = await params;
  const tenantRoute = path?.join("/") || "";
  const eventSlug = path?.length === 2 && (path[0] === "event" || path[0] === "events") ? path[1] : null;
  const allowedRoutes = [
    "",
    "admissions",
    "admissions/login",
    "admissions/change-password",
    "admissions/portal",
  ];
  if (!allowedRoutes.includes(tenantRoute) && !eventSlug) notFound();

  const tenant = await getRequestTenant(slug);
  if (!tenant) notFound();
  if (eventSlug) {
    const event = await getPublishedPublicEvent(tenant.id, eventSlug);
    if (!event) notFound();
    if (path?.[0] === "events") redirect(`/event/${event.slug}`);
    return <PublicEventPage tenant={tenant} event={event} />;
  }
  const studentLoginUrl = await getStudentLoginUrl();
  if (!tenantRoute) {
    const publicEvents = await listPublishedPublicEvents(tenant.id);
    return (
      <InstitutionHomepage
        tenant={tenant}
        baseDomain={await getPublicSiteBaseDomain()}
        studentLoginUrl={studentLoginUrl}
        publicEvents={publicEvents}
      />
    );
  }
  if (tenantRoute === "admissions")
    return (
      <TenantAdmissionsPage tenant={tenant} studentLoginUrl={studentLoginUrl} />
    );
  if (tenantRoute === "admissions/login")
    return (
      <ApplicantLoginPage tenant={tenant} studentLoginUrl={studentLoginUrl} />
    );
  if (tenantRoute === "admissions/change-password")
    return (
      <ApplicantChangePasswordPage
        tenant={tenant}
        studentLoginUrl={studentLoginUrl}
      />
    );
  if (tenantRoute === "admissions/portal")
    return (
      <ApplicantPortalPage tenant={tenant} studentLoginUrl={studentLoginUrl} />
    );

  const publicUrl = institutionPublicUrl(
    tenant.publicSlug,
    undefined,
    "https:",
    await getPublicSiteBaseDomain(),
  );
  const publicHostname = new URL(publicUrl).hostname;
  const institutionType =
    tenant.type.charAt(0) + tenant.type.slice(1).toLowerCase();
  const introduction =
    tenant.description ||
    `${institutionType} based in ${tenant.city}, ${tenant.country}. Institution information and admission updates are published here.`;
  const hasPublicContact = Boolean(
    tenant.publicEmail || tenant.publicPhone || tenant.publicAddress,
  );
  const hasRenderableLogo =
    tenant.logoKey.startsWith("http") || tenant.logoKey.startsWith("/");
  const organizationId = `${publicUrl}#organization`;
  const socialProfiles = [
    tenant.facebookUrl,
    tenant.instagramUrl,
    tenant.youtubeUrl,
  ].filter((url): url is string => Boolean(url));
  const absoluteLogo = hasRenderableLogo
    ? new URL(tenant.logoKey, publicUrl).toString()
    : undefined;
  const absoluteHeroImage = tenant.heroImageUrl
    ? new URL(tenant.heroImageUrl, publicUrl).toString()
    : undefined;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": tenant.type === "SCHOOL" ? "School" : "CollegeOrUniversity",
        "@id": organizationId,
        name: tenant.name,
        url: publicUrl,
        description: introduction,
        logo: absoluteLogo,
        image: absoluteHeroImage || absoluteLogo,
        email: tenant.publicEmail || undefined,
        telephone: tenant.publicPhone || undefined,
        sameAs: socialProfiles.length ? socialProfiles : undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: tenant.publicAddress || undefined,
          addressLocality: tenant.city,
          addressCountry: tenant.country,
        },
        contactPoint:
          tenant.publicEmail || tenant.publicPhone
            ? {
                "@type": "ContactPoint",
                contactType: "admissions and general enquiries",
                email: tenant.publicEmail || undefined,
                telephone: tenant.publicPhone || undefined,
              }
            : undefined,
      },
      {
        "@type": "WebSite",
        "@id": `${publicUrl}#website`,
        url: publicUrl,
        name: tenant.name,
        description: introduction,
        publisher: { "@id": organizationId },
        inLanguage: "en-PK",
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <div
      className="min-h-screen bg-[#f5f3ed] text-[#18201d]"
      style={{ "--site-accent": tenant.accentColor } as CSSProperties}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label={`${tenant.name} home`}
          >
            {hasRenderableLogo ? (
              <Image
                className="h-11 w-11 rounded-xl border border-black/10 bg-white object-contain p-1"
                src={tenant.logoKey}
                alt=""
                width={44}
                height={44}
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--site-accent)] text-sm font-bold text-white">
                {tenant.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="truncate font-display text-lg font-semibold">
              {tenant.name}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admissions/login"
              className="text-xs font-semibold text-stone-600 sm:text-sm"
            >
              Applicant portal
            </Link>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tenant.admissionsEnabled ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}
            >
              Admissions {tenant.admissionsEnabled ? "open" : "closed"}
            </span>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(199,222,93,0.35),transparent_38%),linear-gradient(135deg,#f5f3ed_0%,#e8eee7_100%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-[1.4fr_0.6fr] md:py-28">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-[var(--site-accent)]">
                Official institution website
              </p>
              <h1 className="max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
                {tenant.name}
              </h1>
              {tenant.tagline && (
                <p className="mt-5 max-w-3xl text-2xl font-semibold leading-9 text-stone-800">
                  {tenant.tagline}
                </p>
              )}
              <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-8 text-stone-600">
                {introduction}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                {tenant.admissionsEnabled ? (
                  <Link
                    href="/admissions"
                    className="rounded-lg bg-[var(--site-accent)] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Apply for admission
                  </Link>
                ) : (
                  <span className="rounded-lg border border-black/15 bg-white/70 px-5 py-3 text-sm font-semibold text-stone-700">
                    Admissions are not currently open
                  </span>
                )}
              </div>
            </div>

            <aside className="self-end rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_rgba(24,32,29,0.08)]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Institution details
              </p>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-xs text-stone-500">Type</dt>
                  <dd className="mt-1 font-semibold">{institutionType}</dd>
                </div>
                <div className="border-t border-black/10 pt-4">
                  <dt className="text-xs text-stone-500">Location</dt>
                  <dd className="mt-1 font-semibold">
                    {tenant.city}, {tenant.country}
                  </dd>
                </div>
                <div className="border-t border-black/10 pt-4">
                  <dt className="text-xs text-stone-500">Website</dt>
                  <dd className="mt-1 break-all font-mono text-sm">
                    {publicHostname}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-black/10 bg-white p-6">
              <p className="text-sm font-bold text-[var(--site-accent)]">01</p>
              <h2 className="mt-4 text-xl font-semibold">
                Official information
              </h2>
              <p className="mt-3 leading-7 text-stone-600">
                Updates shown on this website come directly from the
                institution.
              </p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-6">
              <p className="text-sm font-bold text-[var(--site-accent)]">02</p>
              <h2 className="mt-4 text-xl font-semibold">Admission status</h2>
              <p className="mt-3 leading-7 text-stone-600">
                Check here to see when the institution is accepting
                applications.
              </p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-6">
              <p className="text-sm font-bold text-[var(--site-accent)]">03</p>
              <h2 className="mt-4 text-xl font-semibold">
                Powered by Nisaab360
              </h2>
              <p className="mt-3 leading-7 text-stone-600">
                A verified digital presence connected to the institution
                management platform.
              </p>
            </article>
          </div>
        </section>

        {hasPublicContact && (
          <section className="border-t border-black/10 bg-white">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--site-accent)]">
                Contact
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Contact {tenant.name}
              </h2>
              <div className="mt-8 flex flex-wrap gap-3">
                {tenant.publicEmail && (
                  <a
                    className="rounded-lg bg-[var(--site-accent)] px-5 py-3 text-sm font-semibold text-white"
                    href={`mailto:${tenant.publicEmail}`}
                  >
                    Email institution
                  </a>
                )}
                {tenant.publicPhone && (
                  <a
                    className="rounded-lg border border-black/15 px-5 py-3 text-sm font-semibold"
                    href={`tel:${tenant.publicPhone}`}
                  >
                    Call {tenant.publicPhone}
                  </a>
                )}
              </div>
              {tenant.publicAddress && (
                <p className="mt-6 max-w-2xl whitespace-pre-line leading-7 text-stone-600">
                  {tenant.publicAddress}
                </p>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-black/10 bg-[var(--site-accent)] text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            &copy; {new Date().getFullYear()} {tenant.name}
          </p>
          <p>Powered by Nisaab360</p>
        </div>
      </footer>
    </div>
  );
}

async function getApplicantAccount(institutionId: number) {
  const cookieStore = await cookies();
  const session = await verifyAdmissionSessionToken(
    cookieStore.get(ADMISSION_SESSION_COOKIE)?.value,
  );
  if (!session || session.institutionId !== institutionId) return null;
  const [account] = await db
    .select()
    .from(admissionApplicantAccounts)
    .where(
      and(
        eq(admissionApplicantAccounts.id, session.applicantId),
        eq(admissionApplicantAccounts.institutionId, institutionId),
      ),
    )
    .limit(1);
  if (!account || account.sessionVersion !== session.sessionVersion)
    return null;
  const [remainingApplication] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(
      and(
        eq(admissionApplications.institutionId, institutionId),
        eq(admissionApplications.applicantId, account.id),
        or(
          ne(admissionApplications.status, "ENROLLED"),
          sql`exists (
        select 1 from ${admissionEnrollments}
        where ${admissionEnrollments.applicationId} = ${admissionApplications.id}
          and ${admissionEnrollments.institutionId} = ${institutionId}
          and ${admissionEnrollments.createdAt} >= now() - interval '7 days'
      )`,
        ),
      ),
    )
    .limit(1);
  return remainingApplication ? account : null;
}

function ApplicantPageShell({
  tenant,
  studentLoginUrl,
  title,
  description,
  children,
}: {
  tenant: PublicInstitutionTenant;
  studentLoginUrl: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const hasLogo =
    tenant.logoKey.startsWith("http") || tenant.logoKey.startsWith("/");
  return (
    <div
      className="min-h-screen bg-[#f2efe7] text-[#171c1a]"
      style={{ "--site-accent": tenant.accentColor } as CSSProperties}
    >
      <header className="border-b border-black/10">
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between border-x border-black/10 px-5 sm:px-8">
          {" "}
          <Link href="/" className="flex min-w-0 items-center gap-3">
            {hasLogo && (
              <Image
                src={tenant.logoKey}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 border border-black/10 bg-white object-contain"
              />
            )}
            <span className="truncate font-display text-base font-semibold sm:text-lg">
              {tenant.name}
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href={studentLoginUrl}
              className="text-xs font-semibold text-black/45 hover:text-black"
            >
              Student login
            </Link>
            <Link
              href="/admissions"
              className="text-xs font-bold text-[var(--site-accent)]"
            >
              Admissions
            </Link>
            <Link
              href="/"
              className="hidden text-xs font-semibold text-black/45 hover:text-black sm:block"
            >
              Institution website
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto grid min-h-[calc(100vh-79px)] max-w-[1440px] border-x border-black/10 lg:grid-cols-[0.48fr_0.52fr]">
        <section className="flex flex-col justify-between border-b border-black/10 bg-[var(--site-accent)] p-7 text-white sm:p-12 lg:border-b-0 lg:border-r lg:border-white/15 lg:p-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Applicant access
          </p>
          <div className="py-16">
            <h1 className="max-w-lg font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/65">
              {description}
            </p>
          </div>
          <p className="text-xs text-white/45">
            Secure admissions portal for {tenant.name}
          </p>
        </section>
        <section className="flex items-center bg-[#fbf9f4] p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-md">
            <p className="mb-7 border-b border-black/10 pb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">
              Enter your account details
            </p>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

async function ApplicantLoginPage({
  tenant,
  studentLoginUrl,
}: {
  tenant: PublicInstitutionTenant;
  studentLoginUrl: string;
}) {
  const account = await getApplicantAccount(tenant.id);
  if (account)
    redirect(
      account.mustChangePassword
        ? "/admissions/change-password"
        : "/admissions/portal",
    );
  return (
    <ApplicantPageShell
      tenant={tenant}
      studentLoginUrl={studentLoginUrl}
      title="Applicant login"
      description="Use the parent or guardian email and password created with your first application."
    >
      <ApplicantLoginForm accentColor={tenant.accentColor} />
    </ApplicantPageShell>
  );
}

async function ApplicantChangePasswordPage({
  tenant,
  studentLoginUrl,
}: {
  tenant: PublicInstitutionTenant;
  studentLoginUrl: string;
}) {
  const account = await getApplicantAccount(tenant.id);
  if (!account) redirect("/admissions/login");
  return (
    <ApplicantPageShell
      tenant={tenant}
      studentLoginUrl={studentLoginUrl}
      title={
        account.mustChangePassword
          ? "Replace temporary password"
          : "Change password"
      }
      description="Choose a private password for this institution's applicant portal."
    >
      <ApplicantChangePasswordForm accentColor={tenant.accentColor} />
    </ApplicantPageShell>
  );
}

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Application submitted",
  UNDER_REVIEW: "Under review",
  DOCUMENTS_REQUIRED: "Documents required",
  TEST_SCHEDULED: "Admission test scheduled",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  DECISION_PENDING: "Decision pending",
  OFFERED: "Admission offered",
  REJECTED: "Application not accepted",
  FEE_PENDING: "Fee payment pending",
  FEE_VERIFICATION: "Fee verification pending",
  FEE_VERIFIED: "Fee verified",
  ENROLLED: "Enrolled",
  WITHDRAWN: "Withdrawn",
};

async function ApplicantPortalPage({
  tenant,
  studentLoginUrl,
}: {
  tenant: PublicInstitutionTenant;
  studentLoginUrl: string;
}) {
  const account = await getApplicantAccount(tenant.id);
  if (!account) redirect("/admissions/login");
  if (account.mustChangePassword) redirect("/admissions/change-password");

  const applications = await db
    .select({
      id: admissionApplications.id,
      applicationNumber: admissionApplications.applicationNumber,
      studentName: admissionApplications.studentName,
      status: admissionApplications.status,
      submittedAt: admissionApplications.submittedAt,
      offeringTitle: admissionOfferings.title,
      cycleName: admissionCycles.name,
    })
    .from(admissionApplications)
    .innerJoin(
      admissionOfferings,
      eq(admissionOfferings.id, admissionApplications.offeringId),
    )
    .innerJoin(
      admissionCycles,
      eq(admissionCycles.id, admissionApplications.cycleId),
    )
    .where(
      and(
        eq(admissionApplications.applicantId, account.id),
        eq(admissionApplications.institutionId, tenant.id),
        or(
          ne(admissionApplications.status, "ENROLLED"),
          sql`exists (
          select 1 from ${admissionEnrollments}
          where ${admissionEnrollments.applicationId} = ${admissionApplications.id}
            and ${admissionEnrollments.institutionId} = ${tenant.id}
            and ${admissionEnrollments.createdAt} >= now() - interval '7 days'
        )`,
        ),
      ),
    )
    .orderBy(desc(admissionApplications.submittedAt));

  const applicationIds = applications.map((application) => application.id);
  const [documents, appointments, events, feePayments, enrollments] =
    applicationIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: admissionDocumentRequests.id,
              applicationId: admissionDocumentRequests.applicationId,
              documentName: admissionDocumentRequests.documentName,
              instructions: admissionDocumentRequests.instructions,
              status: admissionDocumentRequests.status,
              reviewerNote: admissionDocumentRequests.reviewerNote,
              createdAt: admissionDocumentRequests.createdAt,
            })
            .from(admissionDocumentRequests)
            .where(
              and(
                eq(admissionDocumentRequests.institutionId, tenant.id),
                inArray(
                  admissionDocumentRequests.applicationId,
                  applicationIds,
                ),
              ),
            )
            .orderBy(asc(admissionDocumentRequests.createdAt)),
          db
            .select()
            .from(admissionAppointments)
            .where(
              and(
                eq(admissionAppointments.institutionId, tenant.id),
                inArray(admissionAppointments.applicationId, applicationIds),
              ),
            )
            .orderBy(asc(admissionAppointments.scheduledAt)),
          db
            .select()
            .from(admissionApplicationEvents)
            .where(
              and(
                eq(admissionApplicationEvents.institutionId, tenant.id),
                inArray(
                  admissionApplicationEvents.applicationId,
                  applicationIds,
                ),
                eq(admissionApplicationEvents.visibleToApplicant, true),
              ),
            )
            .orderBy(asc(admissionApplicationEvents.createdAt)),
          db
            .select({
              id: admissionFeePayments.id,
              applicationId: admissionFeePayments.applicationId,
              amount: admissionFeePayments.amount,
              dueDate: admissionFeePayments.dueDate,
              instructions: admissionFeePayments.instructions,
              bankName: admissionFeePayments.bankName,
              accountNumber: admissionFeePayments.accountNumber,
              qrUrl: admissionFeePayments.qrUrl,
              paymentMethods: admissionFeePayments.paymentMethods,
              payerReference: admissionFeePayments.payerReference,
              payerSourceBank: admissionFeePayments.payerSourceBank,
              status: admissionFeePayments.status,
              reviewerNote: admissionFeePayments.reviewerNote,
              submittedAt: admissionFeePayments.submittedAt,
            })
            .from(admissionFeePayments)
            .where(
              and(
                eq(admissionFeePayments.institutionId, tenant.id),
                inArray(admissionFeePayments.applicationId, applicationIds),
              ),
            ),
          db
            .select({
              applicationId: admissionEnrollments.applicationId,
              loginRollNumber: students.loginRollNumber,
              createdAt: admissionEnrollments.createdAt,
            })
            .from(admissionEnrollments)
            .innerJoin(
              students,
              and(
                eq(students.id, admissionEnrollments.studentId),
                eq(students.institutionId, admissionEnrollments.institutionId),
              ),
            )
            .where(
              and(
                eq(admissionEnrollments.institutionId, tenant.id),
                inArray(admissionEnrollments.applicationId, applicationIds),
              ),
            ),
        ])
      : [[], [], [], [], []];

  return (
    <div
      className="min-h-screen bg-[#f2efe7] text-[#171c1a]"
      style={{ "--site-accent": tenant.accentColor } as CSSProperties}
    >
      <header className="border-b border-black/10">
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between gap-4 border-x border-black/10 px-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-base font-semibold sm:text-lg"
          >
            {tenant.name}
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href={studentLoginUrl}
              className="text-xs font-semibold text-black/45 hover:text-black"
            >
              Student login
            </Link>
            <Link
              href="/admissions"
              className="text-xs font-semibold text-black/45 hover:text-black"
            >
              Admissions
            </Link>
            <ApplicantLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] border-x border-black/10">
        <section className="bg-[var(--site-accent)] px-6 py-12 text-white sm:px-10 lg:px-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Applicant portal
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
            Your applications
          </h1>
          <p className="mt-4 text-sm text-white/60">
            Signed in as {account.guardianEmail}
          </p>
        </section>
        <div className="space-y-px bg-black/10 p-px">
          {applications.map((application) => {
            const applicationDocuments = documents.filter(
              (document) => document.applicationId === application.id,
            );
            const applicationAppointments = appointments.filter(
              (appointment) => appointment.applicationId === application.id,
            );
            const applicationEvents = events.filter(
              (event) => event.applicationId === application.id,
            );
            const feePayment = feePayments.find(
              (payment) => payment.applicationId === application.id,
            );
            const enrollment = enrollments.find(
              (item) => item.applicationId === application.id,
            );
            return (
              <article key={application.id} className="bg-[#fbf9f4] p-6 sm:p-9">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="font-mono text-xs font-bold text-stone-500">
                      {application.applicationNumber}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {application.studentName}
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      {application.offeringTitle} / {application.cycleName}
                    </p>
                  </div>
                  <span className="self-start border-l-2 border-[var(--site-accent)] bg-[#e9e5dc] px-3 py-2 text-xs font-bold text-stone-700">
                    {APPLICATION_STATUS_LABELS[application.status] ||
                      application.status}
                  </span>
                </div>
                {applicationDocuments.length > 0 && (
                  <section className="mt-7 border-t border-black/10 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em]">
                      Requested documents
                    </h3>
                    <ul className="mt-4 border-t border-black/10">
                      {applicationDocuments.map((document) => (
                        <li
                          key={document.id}
                          className="border-b border-black/10 bg-amber-50/50 px-4 py-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">
                              {document.documentName}
                            </span>
                            <span className="text-xs font-bold text-amber-800">
                              {document.status}
                            </span>
                          </div>
                          {document.instructions && (
                            <p className="mt-1 text-stone-600">
                              {document.instructions}
                            </p>
                          )}
                          {document.reviewerNote && (
                            <p className="mt-2 text-xs font-medium text-red-700">
                              Institution note: {document.reviewerNote}
                            </p>
                          )}
                          {(document.status === "REQUESTED" ||
                            document.status === "REJECTED") && (
                            <ApplicantDocumentUpload
                              documentId={document.id}
                              accentColor={tenant.accentColor}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-stone-500">
                      Accepted formats: JPG, PNG, WebP, PDF, DOCX, or TXT.
                      Maximum file size: 5 MB.
                    </p>
                  </section>
                )}
                {applicationAppointments.length > 0 && (
                  <section className="mt-7 border-t border-black/10 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em]">
                      Test and interview schedule
                    </h3>
                    <div className="mt-4 grid gap-px bg-black/10 sm:grid-cols-2">
                      {applicationAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="bg-[#f2efe7] p-4 text-sm"
                        >
                          <p className="font-bold">
                            {appointment.type === "TEST"
                              ? "Admission test"
                              : "Interview"}
                          </p>
                          <p className="mt-2">
                            {new Date(appointment.scheduledAt).toLocaleString(
                              "en-PK",
                              { timeZone: "Asia/Karachi" },
                            )}
                          </p>
                          <p className="mt-1 text-stone-600">
                            {appointment.location}
                          </p>
                          {appointment.instructions && (
                            <p className="mt-2 text-xs text-stone-500">
                              {appointment.instructions}
                            </p>
                          )}
                          <p className="mt-3 text-xs font-bold">
                            Result: {appointment.outcome}
                          </p>
                          {appointment.outcomeNote && (
                            <p className="mt-1 text-xs text-stone-500">
                              {appointment.outcomeNote}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {feePayment && (
                  <section className="mt-7 border-t border-black/10 pt-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em]">
                      Admission fee
                    </h3>
                    <div className="mt-4 border-l-2 border-emerald-700 bg-emerald-50 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-bold">
                          PKR {feePayment.amount.toLocaleString("en-PK")}
                        </p>
                        <span className="text-xs font-bold text-emerald-800">
                          {feePayment.status}
                        </span>
                      </div>
                      {feePayment.dueDate && (
                        <p className="mt-2 font-medium">
                          Due by {feePayment.dueDate}
                        </p>
                      )}
                      {feePayment.paymentMethods.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {feePayment.paymentMethods.map((method) => (
                            <div
                              key={method.id}
                              className="grid gap-4 border border-emerald-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
                            >
                              <dl className="grid content-start gap-3">
                                <div>
                                  <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                    Bank / wallet
                                  </dt>
                                  <dd className="mt-1 font-semibold">
                                    {method.providerName}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                    Account title / username
                                  </dt>
                                  <dd className="mt-1 font-semibold">
                                    {method.accountTitle}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                    Account / IBAN / mobile
                                  </dt>
                                  <dd className="mt-1 break-all font-mono font-bold">
                                    {method.accountNumber}
                                  </dd>
                                </div>
                              </dl>
                              {method.qrUrl && (
                                <div className="text-center">
                                  <Image
                                    src={method.qrUrl}
                                    alt={`${method.providerName} payment QR`}
                                    width={128}
                                    height={128}
                                    unoptimized
                                    className="mx-auto h-32 w-32 border border-stone-200 bg-white object-contain p-2"
                                  />
                                  <p className="mt-1 text-[10px] font-semibold text-stone-500">
                                    Scan to pay
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {feePayment.payerSourceBank && (
                        <p className="mt-3 text-xs text-stone-600">
                          Submitted from:{" "}
                          <strong>{feePayment.payerSourceBank}</strong>
                        </p>
                      )}
                      <p className="mt-3 whitespace-pre-line text-stone-700">
                        {feePayment.instructions}
                      </p>
                      {feePayment.reviewerNote && (
                        <p className="mt-3 text-xs font-semibold text-red-700">
                          Institution note: {feePayment.reviewerNote}
                        </p>
                      )}
                      {application.status === "FEE_PENDING" &&
                        (feePayment.status === "PENDING" ||
                          feePayment.status === "REJECTED") && (
                          <ApplicantFeePayment
                            applicationId={application.id}
                            accentColor={tenant.accentColor}
                          />
                        )}
                    </div>
                  </section>
                )}
                {enrollment && (
                  <section className="mt-7 border-l-4 border-white/30 bg-[var(--site-accent)] p-5 text-white">
                    <h3 className="font-bold">Student account activated</h3>
                    <p className="mt-2 text-sm text-white/80">
                      Permanent student login ID
                    </p>
                    <p className="mt-1 break-all font-mono font-bold">
                      {enrollment.loginRollNumber}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-white/75">
                      The login ID and temporary password were emailed with the
                      subject “Student account activation - Credentials”.
                      Applicant access remains available until{" "}
                      {new Date(
                        new Date(enrollment.createdAt).getTime() +
                          7 * 24 * 60 * 60 * 1000,
                      ).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
                      ; afterward, use the permanent student login.
                    </p>
                  </section>
                )}
                <section className="mt-6 border-t border-black/10 pt-5">
                  <h3 className="text-sm font-bold">Timeline</h3>
                  <ol className="mt-3 space-y-4">
                    <li className="border-l-2 border-[var(--site-accent)] pl-4">
                      <p className="text-sm font-semibold">
                        Application submitted
                      </p>
                      <time className="text-xs text-stone-500">
                        {new Date(application.submittedAt).toLocaleString(
                          "en-PK",
                          { timeZone: "Asia/Karachi" },
                        )}
                      </time>
                    </li>
                    {applicationEvents.map((event) => (
                      <li
                        key={event.id}
                        className="border-l-2 border-[var(--site-accent)] pl-4"
                      >
                        <p className="text-sm font-semibold">{event.title}</p>
                        {event.description && (
                          <p className="mt-1 text-sm text-stone-600">
                            {event.description}
                          </p>
                        )}
                        <time className="text-xs text-stone-500">
                          {new Date(event.createdAt).toLocaleString("en-PK", {
                            timeZone: "Asia/Karachi",
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                </section>
              </article>
            );
          })}
          {applications.length === 0 && (
            <div className="bg-[#fbf9f4] p-10 text-center text-stone-500">
              No applications are linked to this account yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

async function TenantAdmissionsPage({
  tenant,
  studentLoginUrl,
}: {
  tenant: PublicInstitutionTenant;
  studentLoginUrl: string;
}) {
  const [cycle] = tenant.admissionsEnabled
    ? await db
        .select()
        .from(admissionCycles)
        .where(
          and(
            eq(admissionCycles.institutionId, tenant.id),
            eq(admissionCycles.status, "OPEN"),
            sql`(${admissionCycles.opensOn} IS NULL OR ${admissionCycles.opensOn} <= CURRENT_DATE)`,
            sql`(${admissionCycles.closesOn} IS NULL OR ${admissionCycles.closesOn} >= CURRENT_DATE)`,
          ),
        )
        .limit(1)
    : [];

  const offerings = cycle
    ? await db
        .select({
          id: admissionOfferings.id,
          title: admissionOfferings.title,
          description: admissionOfferings.description,
        })
        .from(admissionOfferings)
        .where(
          and(
            eq(admissionOfferings.institutionId, tenant.id),
            eq(admissionOfferings.cycleId, cycle.id),
            eq(admissionOfferings.isActive, true),
          ),
        )
    : [];

  return (
    <div
      className="min-h-screen bg-[#f2efe7] text-[#171c1a]"
      style={{ "--site-accent": tenant.accentColor } as CSSProperties}
    >
      <header className="border-b border-black/10">
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between gap-4 border-x border-black/10 px-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-base font-semibold sm:text-lg"
          >
            {tenant.name}
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href={studentLoginUrl}
              className="text-xs font-semibold text-black/45 hover:text-black"
            >
              Student login
            </Link>
            <Link
              href="/admissions/login"
              className="text-xs font-bold text-[var(--site-accent)]"
            >
              Applicant login
            </Link>
            <Link
              href="/"
              className="hidden text-xs font-semibold text-black/45 hover:text-black sm:block"
            >
              Institution website
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="bg-[var(--site-accent)] text-white">
          <div className="mx-auto max-w-[1440px] border-x border-white/15 px-6 py-14 sm:px-10 sm:py-20 lg:px-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Admissions / {cycle?.academicYear || "Information"}
            </p>
            <h1 className="mt-5 max-w-5xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Apply to {tenant.name}
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/65">
              Submit one accurate application for each student. After
              submission, use the applicant portal to follow every next step.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1440px] border-x border-black/10">
          {!cycle || offerings.length === 0 ? (
            <section className="px-6 py-16 sm:px-10 lg:px-14">
              <div className="max-w-2xl border-l-2 border-[var(--site-accent)] bg-[#fbf9f4] p-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40">
                  Current status
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold">
                  Applications are currently closed
                </h2>
                <p className="mt-4 leading-7 text-black/55">
                  Please check this page again when the institution announces
                  its next admission cycle.
                </p>
              </div>
            </section>
          ) : (
            <div className="grid lg:grid-cols-[0.38fr_0.62fr]">
              <aside className="border-b border-black/10 bg-[#e9e5dc] p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--site-accent)]">
                  Current admission round
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">
                  {cycle.name}
                </h2>
                <p className="mt-2 text-sm text-black/45">
                  Academic year {cycle.academicYear}
                </p>
                {cycle.instructions && (
                  <p className="mt-7 whitespace-pre-line border-t border-black/10 pt-6 text-sm leading-7 text-black/60">
                    {cycle.instructions}
                  </p>
                )}
                {(cycle.requiresTest || cycle.requiresInterview) && (
                  <div className="mt-7 border-t border-black/10 pt-6 text-sm leading-6">
                    {cycle.requiresTest && (
                      <p className="border-b border-black/10 py-3">
                        Physical admission test required
                      </p>
                    )}
                    {cycle.requiresInterview && (
                      <p className="border-b border-black/10 py-3">
                        Interview required
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">
                    Available programs or classes
                  </p>
                  <ul className="mt-3 border-t border-black/10">
                    {offerings.map((offering) => (
                      <li
                        key={offering.id}
                        className="border-b border-black/10 py-4"
                      >
                        <p className="font-display text-lg font-semibold">
                          {offering.title}
                        </p>
                        {offering.description && (
                          <p className="mt-1 text-sm leading-6 text-black/50">
                            {offering.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
              <section className="bg-[#fbf9f4] p-6 sm:p-10 lg:p-12">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--site-accent)]">
                  Application form
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em]">
                  Student information
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">
                  Enter details exactly as they appear on official documents.
                  The institution will contact the parent or guardian about the
                  next step.
                </p>
                <div className="mt-6">
                  <OfflineAdmissionForm
                    institution={{
                      name: tenant.name,
                      logoUrl:
                        tenant.logoKey.startsWith("http") ||
                        tenant.logoKey.startsWith("/")
                          ? tenant.logoKey
                          : null,
                      address: tenant.publicAddress,
                      phone: tenant.publicPhone,
                      email: tenant.publicEmail,
                    }}
                    cycle={{
                      name: cycle.name,
                      academicYear: cycle.academicYear,
                      instructions: cycle.instructions,
                      requiredDocuments: cycle.requiredDocuments,
                      requiresTest: cycle.requiresTest,
                      testDate: cycle.testScheduledAt
                        ? new Date(cycle.testScheduledAt).toLocaleString(
                            "en-PK",
                            { timeZone: "Asia/Karachi" },
                          )
                        : null,
                      testLocation: cycle.testLocation,
                      testInstructions: cycle.testInstructions,
                      requiresInterview: cycle.requiresInterview,
                      interviewDate: cycle.interviewScheduledAt
                        ? new Date(cycle.interviewScheduledAt).toLocaleString(
                            "en-PK",
                            { timeZone: "Asia/Karachi" },
                          )
                        : null,
                      interviewLocation: cycle.interviewLocation,
                      interviewInstructions: cycle.interviewInstructions,
                      admissionFeeAmount: cycle.admissionFeeAmount,
                      admissionFeeDueDays: cycle.admissionFeeDueDays,
                      admissionFeeInstructions: cycle.admissionFeeInstructions,
                      paymentBankName: cycle.paymentBankName,
                      paymentAccountNumber: cycle.paymentAccountNumber,
                      paymentQrUrl: cycle.paymentQrUrl,
                      paymentMethods: cycle.paymentMethods,
                    }}
                    offerings={offerings}
                    accentColor={tenant.accentColor}
                  />
                </div>
                <div className="mt-7 border-t border-black/10 pt-8">
                  <AdmissionsApplicationForm
                    offerings={offerings}
                    accentColor={tenant.accentColor}
                    today={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
