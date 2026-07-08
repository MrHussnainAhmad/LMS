import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and } from "drizzle-orm";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { announcementReads } from "@/db/schema";

export const PATCH = requireRole(["STUDENT", "STAFF", "INSTITUTION", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
          eq(notifications.userRole, session.role),
          eq(notifications.userId, session.userId),
          eq(notifications.isRead, false)
        )
      );

    const unreadAnnouncements = (await getVisibleAnnouncements(session, 1000)).filter((a) => !a.isRead);
    if (unreadAnnouncements.length > 0) {
      const values = unreadAnnouncements.map((a) => ({
        announcementId: a.id,
        userRole: session.role,
        userId: session.userId,
      }));
      await db.insert(announcementReads).values(values).onConflictDoNothing();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
});
