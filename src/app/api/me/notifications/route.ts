import { readBoundedJson } from '@/lib/http';
import { inputErrorResponse } from '@/lib/input-error-response';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray, gte, count, sql } from "drizzle-orm";
import { resolveUserCreatedAt } from "@/lib/user";
import { getRawCachedOrFetch, redis, invalidateReadCacheKeys } from "@/lib/redis";
import type { JWTPayload } from "@/lib/auth-types";

const NOTIFICATIONS_CACHE_TTL_SECONDS = 20;

function notificationsCacheKey(session: JWTPayload) {
  return `cache:notifications:${session.role}:${session.userId}:${session.institutionId ?? "none"}`;
}

function unreadCountCacheKey(session: JWTPayload) {
  return `cache:notifications:unread:${session.role}:${session.userId}:${session.institutionId ?? "none"}`;
}

async function invalidateNotificationCaches(session: JWTPayload) {
  try {
    if (redis.status === "ready") {
      await redis.del(notificationsCacheKey(session), unreadCountCacheKey(session));
    }
  } catch (error) {
    console.warn("Failed to invalidate notification caches", error);
  }
}

export const GET = requireRole(["STUDENT", "STAFF", "PARENT", "INSTITUTION", "INSTITUTION_ADMIN", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    // Raw passthrough: this route hands the cached payload straight back, so
    // parsing it into 50 objects only to re-serialise them is pure waste on
    // every hit. The stored value is byte-identical to what getCachedOrFetch
    // wrote, so existing cache entries stay valid.
    if(req.nextUrl.searchParams.get('fresh')==='1')await invalidateReadCacheKeys([notificationsCacheKey(session),unreadCountCacheKey(session)]);
    const fetchPayload = session.role === 'PARENT' ? async (_key:string,_ttl:number,load:()=>Promise<string>) => load() : getRawCachedOrFetch;
    const payload = await fetchPayload(notificationsCacheKey(session), NOTIFICATIONS_CACHE_TTL_SECONDS, async () => {
      const userCreatedAt = await resolveUserCreatedAt(session);

      const notificationScope = and(
        session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
        eq(notifications.userRole, session.role),
        eq(notifications.userId, session.userId),
        session.role==='PARENT' ? sql`(${notifications.studentId} IS NULL OR EXISTS (SELECT 1 FROM parent_students ps WHERE ps.parent_id=${session.userId} AND ps.institution_id=${session.institutionId} AND ps.student_id=${notifications.studentId}))` : undefined,
        gte(notifications.createdAt, userCreatedAt)
      );

      const [userNotifications, unreadCountRows] = await Promise.all([
        db.select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          message: notifications.message,
          isRead: notifications.isRead,
          referenceId: notifications.referenceId,
          studentId: notifications.studentId,
          data: notifications.data,
          createdAt: notifications.createdAt,
        })
          .from(notifications)
          .where(notificationScope)
          .orderBy(desc(notifications.createdAt))
          .limit(50),
        db.select({ value: count() })
          .from(notifications)
          .where(and(notificationScope, eq(notifications.isRead, false))),
      ]);

      return JSON.stringify({
        notifications: userNotifications,
        unreadCount: unreadCountRows[0]?.value ?? 0,
      });
    });

    return new NextResponse(payload, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    const publicInputError = inputErrorResponse(error);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
});

// Mark specific notifications as read
export const PATCH = requireRole(["STUDENT", "STAFF", "PARENT", "INSTITUTION", "INSTITUTION_ADMIN", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    const body = await readBoundedJson(req);
    const { notificationIds } = body as { notificationIds: number[] };

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one notification to mark as read.' }, { status: 400 });
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

    await invalidateNotificationCaches(session);

    return NextResponse.json({ success: true });
  } catch (error) {
    const publicInputError = inputErrorResponse(error);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    console.error("Error marking notifications as read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
});
