import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feeVoucherCycles, feeVouchers, institutions } from "@/db/schema";
import { eq, and, desc, lt, or } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/auth";
import { getFeeVoucherScheduleState } from "@/lib/fee-voucher-schedule";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type VouchersCursor = { createdAt: Date; id: number };

function parseVouchersCursor(value: string | null): VouchersCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown; id?: unknown };
    const createdAt = new Date(typeof parsed.createdAt === "string" ? parsed.createdAt : "");
    const id = Number(parsed.id);
    if (Number.isNaN(createdAt.getTime()) || !Number.isInteger(id) || id <= 0) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeVouchersCursor({ createdAt, id }: VouchersCursor) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url");
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const cursorParam = req.nextUrl.searchParams.get("cursor");
    const cursor = parseVouchersCursor(cursorParam);
    if (cursorParam && !cursor) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });

    const [institution] = await db.select({
      acceptFeeVouchers: institutions.acceptFeeVouchers,
      openDay: institutions.feeVoucherOpenDay,
      lateDay: institutions.feeVoucherLateDay,
      lateFee: institutions.feeVoucherLateFee,
    })
      .from(institutions)
      .where(eq(institutions.id, session.institutionId!))
      .limit(1);
    if (!institution?.acceptFeeVouchers) {
      return NextResponse.json({ error: "Fee & Finance Features are not enabled" }, { status: 403 });
    }
    if (!institution.openDay || !institution.lateDay) {
      return NextResponse.json({ error: "Your institution has not configured the monthly voucher schedule" }, { status: 403 });
    }

    const monthState = getFeeVoucherScheduleState({
      openDay: institution.openDay,
      lateDay: institution.lateDay,
    });
    const [currentCycle] = await db
      .select()
      .from(feeVoucherCycles)
      .where(and(
        eq(feeVoucherCycles.institutionId, session.institutionId!),
        eq(feeVoucherCycles.studentId, session.userId),
        eq(feeVoucherCycles.billingMonth, monthState.billingMonth),
      ))
      .limit(1);

    const conditions = [
      eq(feeVouchers.studentId, session.userId),
      eq(feeVouchers.institutionId, session.institutionId!),
    ];
    if (cursor) {
      const cursorCondition = or(
        lt(feeVouchers.createdAt, cursor.createdAt),
        and(eq(feeVouchers.createdAt, cursor.createdAt), lt(feeVouchers.id, cursor.id))
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    const voucherPage = await db.select()
      .from(feeVouchers)
      .where(and(...conditions))
      .orderBy(desc(feeVouchers.createdAt), desc(feeVouchers.id))
      .limit(limit + 1);

    const hasNextPage = voucherPage.length > limit;
    const vouchers = hasNextPage ? voucherPage.slice(0, limit) : voucherPage;
    const lastVoucher = vouchers.at(-1);

    return NextResponse.json({
      vouchers,
      nextCursor: hasNextPage && lastVoucher
        ? encodeVouchersCursor({ createdAt: lastVoucher.createdAt, id: lastVoucher.id })
        : null,
      schedule: {
        billingMonth: monthState.billingMonth,
        monthLabel: monthState.monthLabel,
        openDay: institution.openDay,
        lateDay: institution.lateDay,
        configuredLateFee: institution.lateFee,
        status: currentCycle?.status ?? (monthState.isLate ? "LATE" : "DUE"),
        lateFeeAmount: currentCycle?.lateFeeAmount ?? (monthState.isLate ? institution.lateFee : 0),
        canSubmit: monthState.isOpen && currentCycle?.status !== "SUBMITTED",
        alreadySubmitted: currentCycle?.status === "SUBMITTED",
      },
    });
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
    const [institution] = await db.select({
      acceptFeeVouchers: institutions.acceptFeeVouchers,
      openDay: institutions.feeVoucherOpenDay,
      lateDay: institutions.feeVoucherLateDay,
      lateFee: institutions.feeVoucherLateFee,
    })
      .from(institutions)
      .where(eq(institutions.id, session.institutionId!))
      .limit(1);
    if (!institution?.acceptFeeVouchers) {
      return NextResponse.json({ error: "Fee & Finance Features are not enabled" }, { status: 403 });
    }
    if (!institution.openDay || !institution.lateDay) {
      return NextResponse.json({ error: "Monthly voucher schedule is not configured" }, { status: 403 });
    }

    const body = await req.json();
    const { title, imageUrl } = body;

    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";
    if (!cleanTitle || !cleanImageUrl) {
      return NextResponse.json({ error: "Title and Image URL are required" }, { status: 400 });
    }
    if (cleanTitle.length > 255 || cleanImageUrl.length > 500) {
      return NextResponse.json({ error: "Voucher title or image URL is too long" }, { status: 400 });
    }

    const monthState = getFeeVoucherScheduleState({
      openDay: institution.openDay,
      lateDay: institution.lateDay,
    });
    if (!monthState.isOpen) {
      return NextResponse.json({
        error: `${monthState.monthLabel} voucher uploads open on day ${institution.openDay}`,
      }, { status: 400 });
    }

    const voucher = await db.transaction(async (tx) => {
      await tx
        .insert(feeVoucherCycles)
        .values({
          institutionId: session.institutionId!,
          studentId: session.userId,
          billingMonth: monthState.billingMonth,
          status: monthState.isLate ? "LATE" : "DUE",
          lateFeeAmount: monthState.isLate ? institution.lateFee : 0,
          lateMarkedAt: monthState.isLate ? new Date() : null,
        })
        .onConflictDoNothing();

      const [cycle] = await tx
        .select()
        .from(feeVoucherCycles)
        .where(and(
          eq(feeVoucherCycles.institutionId, session.institutionId!),
          eq(feeVoucherCycles.studentId, session.userId),
          eq(feeVoucherCycles.billingMonth, monthState.billingMonth),
        ))
        .limit(1);

      if (!cycle) throw new Error("VOUCHER_CYCLE_NOT_FOUND");
      if (cycle.status === "SUBMITTED") throw new Error("VOUCHER_ALREADY_SUBMITTED");

      const lateFeeAmount = monthState.isLate
        ? Math.max(cycle.lateFeeAmount, institution.lateFee)
        : cycle.lateFeeAmount;
      const [createdVoucher] = await tx
        .insert(feeVouchers)
        .values({
          institutionId: session.institutionId!,
          studentId: session.userId,
          title: cleanTitle,
          imageUrl: cleanImageUrl,
          billingMonth: monthState.billingMonth,
          lateFeeAmount,
        })
        .returning();

      await tx
        .update(feeVoucherCycles)
        .set({
          status: "SUBMITTED",
          voucherId: createdVoucher.id,
          lateFeeAmount,
          lateMarkedAt: monthState.isLate ? (cycle.lateMarkedAt ?? new Date()) : cycle.lateMarkedAt,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feeVoucherCycles.id, cycle.id));

      return createdVoucher;
    });

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "VOUCHER_ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "You have already submitted this month’s fee voucher" }, { status: 409 });
    }
    console.error("Error creating fee voucher:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
