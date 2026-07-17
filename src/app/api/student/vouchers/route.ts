import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feeVouchers, institutions } from "@/db/schema";
import { eq, and, desc, lt, or } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/auth";

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

    const [institution] = await db.select({ acceptFeeVouchers: institutions.acceptFeeVouchers })
      .from(institutions)
      .where(eq(institutions.id, session.institutionId!))
      .limit(1);
    if (!institution?.acceptFeeVouchers) {
      return NextResponse.json({ error: "Fee & Finance Features are not enabled" }, { status: 403 });
    }

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
