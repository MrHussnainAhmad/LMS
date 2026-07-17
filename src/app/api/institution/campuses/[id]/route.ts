import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campuses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

export const DELETE = requireRole(["INSTITUTION"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const campusId = parseInt(id);

  if (isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [deleted] = await db.delete(campuses)
      .where(and(eq(campuses.id, campusId), eq(campuses.institutionId, tenantId)))
      .returning({ id: campuses.id });

    if (!deleted) {
      return NextResponse.json({ error: "Campus not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Campus deleted successfully" });
  } catch (error) {
    console.error("Error deleting campus:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
