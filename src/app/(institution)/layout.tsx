import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { institutionOwners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedOrFetch } from "@/lib/redis";
import { getShellBrandForSession } from "@/lib/shell-brand";
import ClientLayout from "./client-layout";
import { OwnerOnboardingForm } from "@/components/institution/OwnerOnboardingForm";
import { CampusReadOnlyBoundary } from "@/components/institution/CampusReadOnlyBoundary";
import { CampusSwitcher } from "@/components/institution/CampusSwitcher";
import { listInstitutionCampuses } from "@/lib/campus-workspaces";

export default async function InstitutionLayoutServer({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword) redirect('/force-password-change');

  if (session.role === "INSTITUTION" && !session.campusReadOnly) {
    const hasOwner = await getCachedOrFetch(
      `cache:institution:owner-exists:${session.userId}`,
      300,
      async () => {
        const [owner] = await db
          .select({ id: institutionOwners.id })
          .from(institutionOwners)
          .where(eq(institutionOwners.institutionId, session.userId))
          .limit(1);
        return { exists: Boolean(owner) };
      }
    );

    if (!hasOwner.exists) {
      return <OwnerOnboardingForm />;
    }
  }

  const [brand, campusList] = await Promise.all([
    getShellBrandForSession(session),
    session.role === 'INSTITUTION' ? listInstitutionCampuses(session) : Promise.resolve([]),
  ]);
  const availableCampuses = campusList.filter((campus) => campus.name === campus.workspaceName);
  const homeCampus = availableCampuses.find((campus) => campus.workspaceId === session.homeInstitutionId);

  return (
    <ClientLayout
      role={session.role as "INSTITUTION" | "INSTITUTION_ADMIN"}
      userId={session.userId}
      initialBrand={brand}
      dashboardActions={session.role === 'INSTITUTION' && homeCampus && session.campusId ? <CampusSwitcher campuses={availableCampuses} currentCampusId={session.campusId} homeCampusId={homeCampus.id} /> : undefined}
    >
      <CampusReadOnlyBoundary readOnly={Boolean(session.campusReadOnly)} campusName={session.campusName ?? ''} homeCampusName={session.homeCampusName ?? ''}>
        {children}
      </CampusReadOnlyBoundary>
    </ClientLayout>
  );
}
