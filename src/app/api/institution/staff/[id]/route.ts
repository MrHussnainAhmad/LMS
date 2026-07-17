import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

export const DELETE = requireRole(["INSTITUTION"], async (req: NextRequest, { params, session }) => {
  const { id } = await params;
  const tenantId = getTenantContext(session);
  const staffId = parseInt(id);

  if (isNaN(staffId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [deleted] = await db.delete(staff)
      .where(and(eq(staff.id, staffId), eq(staff.institutionId, tenantId)))
      .returning({ id: staff.id });

    if (!deleted) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Staff deleted successfully" });
  } catch (error) {
    console.error("Error deleting staff:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
