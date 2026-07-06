import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcements = await getVisibleAnnouncements(session, 10);
  return NextResponse.json({
    announcements,
    unreadCount: announcements.filter((announcement) => !announcement.isRead).length,
  });
}
