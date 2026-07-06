import { NextResponse } from "next/server";
import { heartbeatOnlineTestAction } from "@/app/actions/online-test-actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const onlineTestId = Number(body.onlineTestId);
    if (!Number.isInteger(onlineTestId) || onlineTestId <= 0) {
      return NextResponse.json({ error: "Invalid test" }, { status: 400 });
    }

    const result = await heartbeatOnlineTestAction(onlineTestId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update heartbeat" }, { status: 400 });
  }
}
