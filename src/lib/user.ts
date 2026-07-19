import { db } from "@/db";
import { students, staff, institutions, employees, superAdmins, institutionAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "./redis";
import type { JWTPayload, UserRole } from "./auth-types";

/**
 * Prefer createdAt embedded in the JWT (set at login/refresh). Falls back to a
 * DB lookup for older tokens that predate the claim.
 */
export async function resolveUserCreatedAt(session: JWTPayload): Promise<Date> {
  if (session.createdAt) {
    const parsed = new Date(session.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return getUserCreatedAt(session);
}

export async function getUserCreatedAt(session: JWTPayload): Promise<Date> {
  const defaultDate = new Date(0);
  switch (session.role) {
    case "STUDENT": {
      const [u] = await db.select({ createdAt: students.createdAt }).from(students).where(eq(students.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "STAFF": {
      const [u] = await db.select({ createdAt: staff.createdAt }).from(staff).where(eq(staff.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "INSTITUTION": {
      const [u] = await db.select({ createdAt: institutions.createdAt }).from(institutions).where(eq(institutions.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "INSTITUTION_ADMIN": {
      const [u] = await db.select({ createdAt: institutionAdmins.createdAt }).from(institutionAdmins).where(eq(institutionAdmins.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "EMPLOYEE": {
      const [u] = await db.select({ createdAt: employees.createdAt }).from(employees).where(eq(employees.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "SUPER_ADMIN": {
      const [u] = await db.select({ createdAt: superAdmins.createdAt }).from(superAdmins).where(eq(superAdmins.id, session.userId)).limit(1);
      return u?.createdAt || defaultDate;
    }
    default:
      return defaultDate;
  }
}

const USER_VALIDITY_CACHE_TTL_SECONDS = 30;

function userValidityCacheKey(role: UserRole, userId: number) {
  return `auth:user-validity:${role}:${userId}`;
}

async function verifyUserExistsInDatabase(role: UserRole, userId: number): Promise<boolean> {
  switch (role) {
    case 'SUPER_ADMIN': {
      const [u] = await db.select({ id: superAdmins.id }).from(superAdmins).where(eq(superAdmins.id, userId)).limit(1);
      return !!u;
    }
    case 'EMPLOYEE': {
      const [u] = await db.select({ deletedAt: employees.deletedAt }).from(employees).where(eq(employees.id, userId)).limit(1);
      return !!u && u.deletedAt === null;
    }
    case 'INSTITUTION': {
      const [u] = await db.select({ status: institutions.status }).from(institutions).where(eq(institutions.id, userId)).limit(1);
      return u?.status === 'APPROVED';
    }
    case 'INSTITUTION_ADMIN': {
      const [u] = await db.select({ id: institutionAdmins.id }).from(institutionAdmins).where(eq(institutionAdmins.id, userId)).limit(1);
      return !!u;
    }
    case 'STAFF': {
      const [u] = await db.select({ isActive: staff.isActive }).from(staff).where(eq(staff.id, userId)).limit(1);
      return !!u?.isActive;
    }
    case 'STUDENT': {
      const [u] = await db.select({ isActive: students.isActive }).from(students).where(eq(students.id, userId)).limit(1);
      return !!u?.isActive;
    }
    default:
      return false;
  }
}

/**
 * Shared, short-lived validity cache for authenticated requests. Valkey errors
 * deliberately fall through to Postgres so an outage cannot grant or deny access.
 */
export async function verifyUserExists(role: UserRole, userId: number): Promise<boolean> {
  const key = userValidityCacheKey(role, userId);

  try {
    if (redis.status === "ready") {
      const cached = await redis.get(key);
      if (cached === "1") return true;
      if (cached === "0") return false;
    }
  } catch (error) {
    console.warn("User validity cache read failed; checking Postgres", error);
  }

  const valid = await verifyUserExistsInDatabase(role, userId);

  try {
    if (redis.status === "ready") {
      // Exact TTL: do not use cache TTL jitter for an authorization decision.
      await redis.setex(key, USER_VALIDITY_CACHE_TTL_SECONDS, valid ? "1" : "0");
    }
  } catch (error) {
    console.warn("User validity cache write failed; continuing without cache", error);
  }

  return valid;
}

export async function invalidateUserValidity(role: UserRole, userId: number) {
  try {
    if (redis.status === "ready") {
      await redis.del(userValidityCacheKey(role, userId));
    }
  } catch (error) {
    console.warn("User validity cache invalidation failed", error);
  }
}

export async function invalidateUserValidityBatch(users: Array<{ role: UserRole; userId: number }>) {
  const keys = [...new Set(users.map(({ role, userId }) => userValidityCacheKey(role, userId)))];
  if (keys.length === 0) return;

  try {
    if (redis.status === "ready") {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn("User validity cache batch invalidation failed", error);
  }
}
