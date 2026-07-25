import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { institutionOwners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedOrFetch } from "@/lib/redis";
import { getShellBrandForSession } from "@/lib/shell-brand";
import ClientLayout from "./client-layout";
import { OwnerOnboardingForm } from "@/components/institution/OwnerOnboardingForm";

export default async function InstitutionLayoutServer({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const institutionId = session.institutionId || session.userId;

  if (session.role === "INSTITUTION") {
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

  const brand = await getShellBrandForSession(session);

  return (
    <ClientLayout
      role={session.role as "INSTITUTION" | "INSTITUTION_ADMIN"}
      userId={session.userId}
      institutionId={institutionId}
      initialBrand={brand}
    >
      {children}
    </ClientLayout>
  );
}
