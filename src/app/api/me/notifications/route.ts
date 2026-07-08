import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray, gte } from "drizzle-orm";
import { getUserCreatedAt } from "@/lib/user";

export const GET = requireRole(["STUDENT", "STAFF", "INSTITUTION", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    const userCreatedAt = await getUserCreatedAt(session);

    const userNotifications = await db.select()
      .from(notifications)
      .where(
        and(
          session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
          eq(notifications.userRole, session.role),
          eq(notifications.userId, session.userId),
          gte(notifications.createdAt, userCreatedAt)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50); // Get latest 50

    const unreadCountArray = await db.select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
          eq(notifications.userRole, session.role),
          eq(notifications.userId, session.userId),
          eq(notifications.isRead, false),
          gte(notifications.createdAt, userCreatedAt)
        )
      );

    return NextResponse.json({ notifications: userNotifications, unreadCount: unreadCountArray.length });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
});

// Mark specific notifications as read
export const PATCH = requireRole(["STUDENT", "STAFF", "INSTITUTION", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    const body = await req.json();
    const { notificationIds } = body as { notificationIds: number[] };

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
          eq(notifications.userRole, session.role),
          eq(notifications.userId, session.userId),
          inArray(notifications.id, notificationIds)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
});
