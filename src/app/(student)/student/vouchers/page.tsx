import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeeVouchersClient } from "./FeeVouchersClient";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Fee Vouchers | Student",
};

export default async function StudentFeeVouchersPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) {
    redirect("/login");
  }

  const [institution] = await db.select({
    acceptFeeVouchers: institutions.acceptFeeVouchers,
    openDay: institutions.feeVoucherOpenDay,
    lateDay: institutions.feeVoucherLateDay,
  })
    .from(institutions)
    .where(eq(institutions.id, session.institutionId))
    .limit(1);

  if (!institution?.acceptFeeVouchers) {
    // If feature is disabled by institution, redirect away or show not enabled
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <h2 className="text-2xl font-bold text-brand-950 mb-2">Feature Disabled</h2>
        <p className="text-stone-500 max-w-md">Your institution has not enabled fee voucher uploads.</p>
      </div>
    );
  }

  if (!institution.openDay || !institution.lateDay) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="mb-2 text-2xl font-bold text-brand-950">Schedule Not Configured</h2>
        <p className="max-w-md text-stone-500">
          Your institution has enabled fee vouchers but has not configured the monthly upload dates yet.
        </p>
      </div>
    );
  }

  return <FeeVouchersClient />;
}
