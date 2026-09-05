import { db } from "@/db";
import { students, staff, institutions, employees, superAdmins, institutionAdmins, parentAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: students.createdAt }).from(students).where(and(
        eq(students.id, session.userId),
        eq(students.institutionId, session.institutionId),
      )).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "STAFF": {
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: staff.createdAt }).from(staff).where(and(
        eq(staff.id, session.userId),
        eq(staff.institutionId, session.institutionId),
      )).limit(1);
      return u?.createdAt || defaultDate;
    }
    case "PARENT": {
      if (!session.institutionId) return defaultDate;
      const [u] = await db.select({ createdAt: parentAccounts.createdAt }).from(parentAccounts).where(and(
        eq(parentAccounts.id, session.userId),
        eq(parentAccounts.institutionId, session.institutionId),
      )).limit(1);
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

const USER_VALIDITY_CACHE_TTL_SECONDS = 600;

function userValidityCacheKey(role: UserRole, userId: number) {
  return `auth:user-validity:${role}:${userId}`;
}

/**
 * Process-local memo in front of the Valkey validity cache, same shape as
 * `verifiedTokenCache` in `auth-edge.ts`.
 *
 * Cache key: `role:userId`
 * Scope: process-local; one entry per authenticated identity, never shared
 * TTL: 30s — 20x tighter than the 600s Valkey TTL it fronts, so this can only
 *      ever *reduce* the existing staleness window, never widen it
 * Max entries: 1000 (evict oldest insertion; ~40 KB at worst)
 * Fallback: on miss, Valkey then Postgres exactly as before
 *
 * Valkey stays the cross-replica source of truth; `invalidateUserValidity`
 * clears the local map too, so a revocation issued by this process takes effect
 * immediately here and within 30s on the sibling replica.
 */
const LOCAL_VALIDITY_TTL_MS = 30_000;
const LOCAL_VALIDITY_MAX = 1000;
const localValidityCache = new Map<string, { valid: boolean; expMs: number }>();

function readLocalValidity(key: string): boolean | undefined {
  const hit = localValidityCache.get(key);
  if (!hit) return undefined;
  if (hit.expMs <= Date.now()) {
    localValidityCache.delete(key);
    return undefined;
  }
  return hit.valid;
}

function rememberLocalValidity(key: string, valid: boolean) {
  if (localValidityCache.size >= LOCAL_VALIDITY_MAX) {
    const oldest = localValidityCache.keys().next().value;
    if (oldest !== undefined) localValidityCache.delete(oldest);
  }
  localValidityCache.set(key, { valid, expMs: Date.now() + LOCAL_VALIDITY_TTL_MS });
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
      const [u] = await db.select({
        isActive: students.isActive,
        academicStatus: students.academicStatus,
        graduatedAccessAllowed: institutions.allowGraduatedStudentAccess,
      })
        .from(students)
        .innerJoin(institutions, eq(students.institutionId, institutions.id))
        .where(and(eq(students.id, userId), eq(students.isActive, true)))
        .limit(1);
      return !!u && (u.academicStatus !== 'GRADUATED' || u.graduatedAccessAllowed);
    }
    case 'PARENT': {
      const [u] = await db.select({
        status: parentAccounts.status,
        passwordHash: parentAccounts.passwordHash,
        deletedAt: parentAccounts.deletedAt,
        institutionStatus: institutions.status,
      })
        .from(parentAccounts)
        .innerJoin(institutions, eq(parentAccounts.institutionId, institutions.id))
        .where(eq(parentAccounts.id, userId))
        .limit(1);
      return !!u && u.deletedAt === null && u.status !== 'DISABLED' && !!u.passwordHash && u.institutionStatus === 'APPROVED';
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

  // Hot path: no syscall, no round trip. Most authenticated requests land here.
  const local = readLocalValidity(key);
  if (local !== undefined) return local;

  try {
    if (redis.status === "ready") {
      const cached = await redis.get(key);
      if (cached === "1") {
        rememberLocalValidity(key, true);
        return true;
      }
      if (cached === "0") {
        rememberLocalValidity(key, false);
        return false;
      }
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

  rememberLocalValidity(key, valid);
  return valid;
}

export async function invalidateUserValidity(role: UserRole, userId: number) {
  const key = userValidityCacheKey(role, userId);
  localValidityCache.delete(key);
  try {
    if (redis.status === "ready") {
      await redis.del(key);
    }
  } catch (error) {
    console.warn("User validity cache invalidation failed", error);
  }
}

export async function invalidateUserValidityBatch(users: Array<{ role: UserRole; userId: number }>) {
  const keys = [...new Set(users.map(({ role, userId }) => userValidityCacheKey(role, userId)))];
  if (keys.length === 0) return;

  for (const key of keys) localValidityCache.delete(key);

  try {
    if (redis.status === "ready") {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn("User validity cache batch invalidation failed", error);
  }
}
