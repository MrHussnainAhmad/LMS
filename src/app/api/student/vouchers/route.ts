import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feeVouchers, institutions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [institution] = await db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
      .from(institutions)
      .where(eq(institutions.id, session.institutionId!))
      .limit(1);
    if (!institution?.acceptFeeVouchers) {
      return NextResponse.json({ error: "Fee & Finance Features are not enabled" }, { status: 403 });
    }

    const vouchers = await db.select()
      .from(feeVouchers)
      .where(and(
        eq(feeVouchers.studentId, session.userId),
        eq(feeVouchers.institutionId, session.institutionId!)
      ))
      .orderBy(desc(feeVouchers.createdAt));

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error("Error fetching fee vouchers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [institution] = await db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
      .from(institutions)
      .where(eq(institutions.id, session.institutionId!))
      .limit(1);
    if (!institution?.acceptFeeVouchers) {
      return NextResponse.json({ error: "Fee & Finance Features are not enabled" }, { status: 403 });
    }

    const body = await req.json();
    const { title, imageUrl } = body;

    if (!title || !imageUrl) {
      return NextResponse.json({ error: "Title and Image URL are required" }, { status: 400 });
    }

    const [voucher] = await db.insert(feeVouchers).values({
      institutionId: session.institutionId!,
      studentId: session.userId,
      title,
      imageUrl,
    }).returning();

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    console.error("Error creating fee voucher:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
