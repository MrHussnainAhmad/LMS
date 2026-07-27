import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);

  const [institution] = await db.select({
    acceptFeeVouchers: institutions.acceptFeeVouchers,
    feeVoucherOpenDay: institutions.feeVoucherOpenDay,
    feeVoucherLateDay: institutions.feeVoucherLateDay,
    feeVoucherLateFee: institutions.feeVoucherLateFee,
    allowGraduatedStudentAccess: institutions.allowGraduatedStudentAccess,
  }).from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  return NextResponse.json(institution || {});
});

export const POST = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  
  try {
    const body = await req.json();

    if (body.action === "updateFeeVouchers") {
      const { acceptFeeVouchers, openDay, lateDay, lateFee } = body;
      
      if (!acceptFeeVouchers) {
        await db.update(institutions)
          .set({ acceptFeeVouchers: false })
          .where(eq(institutions.id, institutionId));
        return NextResponse.json({ success: true });
      }

      await db.update(institutions)
        .set({
          acceptFeeVouchers: true,
          feeVoucherOpenDay: Number(openDay),
          feeVoucherLateDay: Number(lateDay),
          feeVoucherLateFee: Number(lateFee),
        })
        .where(eq(institutions.id, institutionId));
        
      return NextResponse.json({ success: true });
    }

    if (body.action === "updateGraduatedAccess") {
      const { allowGraduatedStudentAccess } = body;
      await db.update(institutions)
        .set({ allowGraduatedStudentAccess: Boolean(allowGraduatedStudentAccess) })
        .where(eq(institutions.id, institutionId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update settings" }, { status: 500 });
  }
});
