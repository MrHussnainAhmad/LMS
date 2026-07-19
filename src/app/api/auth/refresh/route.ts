import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, institutions, refreshTokens, staff, students, superAdmins } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { clearAuthCookies, createAccessToken, setAuthCookies } from '@/lib/auth';
import type { JWTPayload, UserRole } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getCurrentPayload(role: UserRole, userId: number): Promise<JWTPayload | null> {
  switch (role) {
    case 'SUPER_ADMIN': {
      const [user] = await db.select({
        isSuperAdmin: superAdmins.isSuperAdmin,
        createdAt: superAdmins.createdAt,
      }).from(superAdmins).where(eq(superAdmins.id, userId)).limit(1);
      return user ? {
        userId,
        role,
        isSuperAdmin: user.isSuperAdmin,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    case 'EMPLOYEE': {
      const [user] = await db.select({
        mustChangePassword: employees.mustChangePassword,
        createdAt: employees.createdAt,
      }).from(employees).where(eq(employees.id, userId)).limit(1);
      return user ? {
        userId,
        role,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    case 'INSTITUTION': {
      const [user] = await db.select({
        status: institutions.status,
        createdAt: institutions.createdAt,
      }).from(institutions).where(eq(institutions.id, userId)).limit(1);
      return user?.status === 'APPROVED' ? {
        userId,
        role,
        institutionId: userId,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    case 'STAFF': {
      const [user] = await db.select({
        institutionId: staff.institutionId,
        campusId: staff.campusId,
        mustChangePassword: staff.mustChangePassword,
        isActive: staff.isActive,
        createdAt: staff.createdAt,
      }).from(staff).where(eq(staff.id, userId)).limit(1);
      return user?.isActive ? {
        userId,
        role,
        institutionId: user.institutionId,
        campusId: user.campusId,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    case 'STUDENT': {
      const [user] = await db.select({
        institutionId: students.institutionId,
        mustChangePassword: students.mustChangePassword,
        isActive: students.isActive,
        createdAt: students.createdAt,
      }).from(students).where(eq(students.id, userId)).limit(1);
      return user?.isActive ? {
        userId,
        role,
        institutionId: user.institutionId,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    case 'INSTITUTION_ADMIN': {
      const { institutionAdmins } = await import('@/db/schema');
      const [user] = await db.select({
        institutionId: institutionAdmins.institutionId,
        createdAt: institutionAdmins.createdAt,
      }).from(institutionAdmins).where(eq(institutionAdmins.id, userId)).limit(1);
      return user ? {
        userId,
        role,
        institutionId: user.institutionId,
        createdAt: user.createdAt.toISOString(),
      } : null;
    }
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const body = await req.json().catch(() => ({}));
  const refreshToken = typeof body.refreshToken === 'string'
    ? body.refreshToken
    : cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const [record] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);

  if (!record) {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  if (record.revokedAt) {
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  if (record.expiresAt < new Date()) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, record.id));
    await clearAuthCookies();
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const payload = await getCurrentPayload(record.userRole, record.userId);
  if (!payload) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, record.id));
    await clearAuthCookies();
    return NextResponse.json({ error: 'Account is unavailable' }, { status: 401 });
  }

  const accessToken = await createAccessToken(payload);
  await setAuthCookies(accessToken, refreshToken);

  return NextResponse.json({
    message: 'Token refreshed',
    ...(typeof body.refreshToken === 'string' ? { accessToken, refreshToken } : {}),
  });
}
