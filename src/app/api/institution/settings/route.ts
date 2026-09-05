import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { invalidateStudentEnrichCache } from "@/lib/redis";

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);

  const [institution] = await db.select({
    name: institutions.name,
    type: institutions.type,
    username: institutions.username,
    registrationNumber: institutions.registrationNumber,
    contactEmail: institutions.contactEmail,
    contactPhone: institutions.contactPhone,
    address: institutions.address,
    city: institutions.city,
    country: institutions.country,
    logoKey: institutions.logoKey,
    signatureKey: institutions.signatureKey,
    allowGraduatedStudentAccess: institutions.allowGraduatedStudentAccess,
  }).from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  return NextResponse.json({ profile: institution || {} });
});

export const POST = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  
  try {
    const body = await req.json();

    if (body.action === "updateGraduatedAccess") {
      const { allowGraduatedStudentAccess } = body;
      await db.update(institutions)
        .set({ allowGraduatedStudentAccess: Boolean(allowGraduatedStudentAccess) })
        .where(eq(institutions.id, institutionId));
      // This flag gates graduated students' access, and cached session
      // enrichment (lib/auth.ts) carries a copy of it — clear it so the toggle
      // takes effect on the next request rather than after the cache TTL.
      await invalidateStudentEnrichCache(institutionId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 },
    );
  }
});
