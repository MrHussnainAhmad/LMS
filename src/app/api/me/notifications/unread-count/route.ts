import { inputErrorResponse } from '@/lib/input-error-response';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { resolveUserCreatedAt } from "@/lib/user";
import { getCachedOrFetch } from "@/lib/redis";
import { withRateLimit } from "@/lib/rate-limit";
import type { JWTPayload } from "@/lib/auth-types";

const NOTIFICATIONS_CACHE_TTL_SECONDS = 20;

function unreadCountCacheKey(session: JWTPayload) {
  return `cache:notifications:unread:${session.role}:${session.userId}:${session.institutionId ?? "none"}`;
}

export const GET = requireRole(["STUDENT", "STAFF", "PARENT", "INSTITUTION", "INSTITUTION_ADMIN", "EMPLOYEE", "SUPER_ADMIN"], async (req: NextRequest, { session }) => {
  try {
    const rateLimit = await withRateLimit(req, "unread");
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const cachedOrLoad = session.role==='PARENT'?async (_key:string,_ttl:number,load:()=>Promise<{unreadCount:number}>)=>load():getCachedOrFetch;
    const payload = await cachedOrLoad(unreadCountCacheKey(session), NOTIFICATIONS_CACHE_TTL_SECONDS, async () => {
      const userCreatedAt = await resolveUserCreatedAt(session);

      const [unreadCountRows] = await db.select({ value: count() })
        .from(notifications)
        .where(and(
          session.institutionId ? eq(notifications.institutionId, session.institutionId) : undefined,
          eq(notifications.userRole, session.role),
          eq(notifications.userId, session.userId),
          session.role==='PARENT'?sql`(${notifications.studentId} IS NULL OR EXISTS (SELECT 1 FROM parent_students ps WHERE ps.parent_id=${session.userId} AND ps.institution_id=${session.institutionId} AND ps.student_id=${notifications.studentId}))`:undefined,
          gte(notifications.createdAt, userCreatedAt),
          eq(notifications.isRead, false),
        ));

      return { unreadCount: unreadCountRows?.value ?? 0 };
    });

    return NextResponse.json(payload);
  } catch (error) {
    const publicInputError = inputErrorResponse(error);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    console.error("Error fetching unread notification count:", error);
    return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 });
  }
}, { light: true });
