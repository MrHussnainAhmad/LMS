import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sections } from "@/db/schema";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { eq } from "drizzle-orm";

// Lightweight sections list (id, classId, name) — used by forms like Publish Results
// that need to filter sections by class client-side without a heavier join.
export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);

  const rows = await db.select({ id: sections.id, classId: sections.classId, name: sections.name })
    .from(sections)
    .where(eq(sections.institutionId, institutionId));

  return NextResponse.json({ sections: rows });
});
