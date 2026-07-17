import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { institutions, staff, students, refreshTokens, accountDeletions } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN") || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const institutionId = session.institutionId || session.userId;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || null;

    // Fetch the institution
    const [institution] = await db.select({
      name: institutions.name,
      contactEmail: institutions.contactEmail
    }).from(institutions).where(eq(institutions.id, institutionId));

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    // Get all associated staff IDs
    const associatedStaff = await db.select({ id: staff.id })
      .from(staff)
      .where(eq(staff.institutionId, institutionId));
    const staffIds = associatedStaff.map((s) => s.id);

    // Get all associated student IDs
    const associatedStudents = await db.select({ id: students.id })
      .from(students)
      .where(eq(students.institutionId, institutionId));
    const studentIds = associatedStudents.map((s) => s.id);

    // Run in a transaction? No, Neon serverless driver over HTTP might not support standard interactive transactions if not careful, but drizzle does.
    // However, it's safer to just do the operations sequentially, the cascade will handle most things.
    // Drizzle Neon HTTP doesn't fully support all transaction features depending on the driver. Let's do it sequentially.

    // 1. Delete refresh tokens
    // Delete institution token
    await db.delete(refreshTokens)
      .where(and(eq(refreshTokens.userRole, "INSTITUTION"), eq(refreshTokens.userId, institutionId)));
    
    // Delete staff tokens
    if (staffIds.length > 0) {
      await db.delete(refreshTokens)
        .where(and(eq(refreshTokens.userRole, "STAFF"), inArray(refreshTokens.userId, staffIds)));
    }

    // Delete student tokens
    if (studentIds.length > 0) {
      await db.delete(refreshTokens)
        .where(and(eq(refreshTokens.userRole, "STUDENT"), inArray(refreshTokens.userId, studentIds)));
    }

    // 2. Log deletion reason
    await db.insert(accountDeletions).values({
      institutionName: institution.name,
      adminEmail: institution.contactEmail,
      reason: reason,
    });

    // 3. Delete the institution (Cascades staff, students, sessions, campuses, etc.)
    await db.delete(institutions).where(eq(institutions.id, institutionId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
