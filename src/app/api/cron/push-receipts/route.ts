import { NextRequest, NextResponse } from "next/server";
import { checkExpoPushReceipts } from "@/lib/notifications";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not configured; rejecting push receipt cron request");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");
  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkExpoPushReceipts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Push receipt check failed:", error);
    return NextResponse.json({ error: "Push receipt check failed" }, { status: 500 });
  }
}
