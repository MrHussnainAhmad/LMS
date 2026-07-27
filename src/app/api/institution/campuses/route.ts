import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campuses } from "@/db/schema";
import { requireRole, getTenantContext } from "@/lib/rbac";
import { eq } from "drizzle-orm";

/** Lightweight campus list for forms (Add Student, etc.) — load only when a dialog needs it. */
export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (_req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);

  const rows = await db
    .select({ id: campuses.id, name: campuses.name })
    .from(campuses)
    .where(eq(campuses.institutionId, institutionId));

  return NextResponse.json({ campuses: rows });
});


export const POST = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const body = await req.json();
  const { name, location, status } = body;
  
  if (!name || !location) {
    return NextResponse.json({ error: "Name and location are required" }, { status: 400 });
  }
  
  const [inserted] = await db.insert(campuses).values({
    institutionId,
    name,
    location,
    status: status || 'Active',
  }).returning();
  
  return NextResponse.json({ success: true, campus: inserted });
});
