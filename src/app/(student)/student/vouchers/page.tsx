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

  const [institution] = await db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
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

  return <FeeVouchersClient />;
}
