import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { institutionOwners } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  // Allow INSTITUTION_ADMIN to bypass owner onboarding, 
  // but block them if owner hasn't onboarded yet? Actually, admins shouldn't exist if owner hasn't onboarded.
  if (session.role === "INSTITUTION") {
    // Check if owner details are filled
    const owner = await db.select().from(institutionOwners).where(eq(institutionOwners.institutionId, session.userId)).limit(1);
    
    if (owner.length === 0) {
      // Return onboarding form instead of children
      return <OwnerOnboardingForm />;
    }
  }

  return <ClientLayout role={session.role as "INSTITUTION" | "INSTITUTION_ADMIN"}>{children}</ClientLayout>;
}
