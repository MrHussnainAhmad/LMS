import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { institutions, institutionAdmins, staff, students, refreshTokens, accountDeletions } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { invalidateUserValidityBatch } from "@/lib/user";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN") || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const institutionId = session.institutionId || session.userId;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || null;

    const affectedUsers = await db.transaction(async (tx) => {
      const [institution] = await tx.select({
        name: institutions.name,
        contactEmail: institutions.contactEmail,
      }).from(institutions).where(eq(institutions.id, institutionId));

      if (!institution) {
        throw new Error("Institution not found");
      }

      const associatedStaff = await tx.select({ id: staff.id })
        .from(staff)
        .where(eq(staff.institutionId, institutionId));
      const associatedStudents = await tx.select({ id: students.id })
        .from(students)
        .where(eq(students.institutionId, institutionId));
      const associatedInstitutionAdmins = await tx.select({ id: institutionAdmins.id })
        .from(institutionAdmins)
        .where(eq(institutionAdmins.institutionId, institutionId));
      const staffIds = associatedStaff.map((row) => row.id);
      const studentIds = associatedStudents.map((row) => row.id);

      await tx.delete(refreshTokens)
        .where(and(eq(refreshTokens.userRole, "INSTITUTION"), eq(refreshTokens.userId, institutionId)));
      if (staffIds.length > 0) {
        await tx.delete(refreshTokens)
          .where(and(eq(refreshTokens.userRole, "STAFF"), inArray(refreshTokens.userId, staffIds)));
      }
      if (studentIds.length > 0) {
        await tx.delete(refreshTokens)
          .where(and(eq(refreshTokens.userRole, "STUDENT"), inArray(refreshTokens.userId, studentIds)));
      }

      await tx.insert(accountDeletions).values({
        institutionName: institution.name,
        adminEmail: institution.contactEmail,
        reason,
      });
      await tx.delete(institutions).where(eq(institutions.id, institutionId));

      return { staffIds, studentIds, institutionAdminIds: associatedInstitutionAdmins.map((row) => row.id) };
    });

    await invalidateUserValidityBatch([
      { role: "INSTITUTION", userId: institutionId },
      ...affectedUsers.staffIds.map((userId) => ({ role: "STAFF" as const, userId })),
      ...affectedUsers.studentIds.map((userId) => ({ role: "STUDENT" as const, userId })),
      ...affectedUsers.institutionAdminIds.map((userId) => ({ role: "INSTITUTION_ADMIN" as const, userId })),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof Error && error.message === "Institution not found") {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
