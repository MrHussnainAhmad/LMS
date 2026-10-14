import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expanded = req.nextUrl.searchParams.has('page');
  const page = Math.max(1, Math.min(5, Math.floor(Number(req.nextUrl.searchParams.get('page')) || 1)));
  const visible = await getVisibleAnnouncements(session, expanded ? 50 : 10);
  const announcements = expanded ? visible.slice((page - 1) * 10, page * 10) : visible;
  return NextResponse.json({
    announcements,
    pagination: { page, pages: Math.max(1, Math.ceil(visible.length / 10)), total: visible.length },
    unreadCount: announcements.filter((announcement) => !announcement.isRead).length,
  });
}
