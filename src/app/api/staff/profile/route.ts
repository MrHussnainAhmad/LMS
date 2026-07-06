import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { staff, campuses } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { and, eq } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [profile] = await db
      .select({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        campusName: campuses.name,
      })
      .from(staff)
      .leftJoin(campuses, eq(staff.campusId, campuses.id))
      .where(and(eq(staff.id, session.userId), eq(staff.institutionId, session.institutionId)));

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
});
