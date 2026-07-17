import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, staff, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword as hash, verifyPassword as verify } from '@/lib/argon2-pool';
import { requireRole } from '@/lib/rbac';
import { changePasswordSchema } from '@/lib/validators/auth';
import { logAudit } from '@/lib/audit';
import { createTokens, setAuthCookies } from '@/lib/auth';
import { invalidateUserValidity } from '@/lib/user';

async function getPasswordHashForSession(role: string, userId: number) {
  if (role === 'EMPLOYEE') {
    const [user] = await db.select({ passwordHash: employees.passwordHash }).from(employees).where(eq(employees.id, userId)).limit(1);
    return user;
  }
  if (role === 'STAFF') {
    const [user] = await db.select({ passwordHash: staff.passwordHash }).from(staff).where(eq(staff.id, userId)).limit(1);
    return user;
  }
  if (role === 'STUDENT') {
    const [user] = await db.select({ passwordHash: students.passwordHash }).from(students).where(eq(students.id, userId)).limit(1);
    return user;
  }
}

async function updatePasswordForSession(role: string, userId: number, passwordHash: string) {
  if (role === 'EMPLOYEE') {
    await db.update(employees)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(employees.id, userId));
    return;
  }
  if (role === 'STAFF') {
    await db.update(staff)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(staff.id, userId));
    return;
  }
  if (role === 'STUDENT') {
    await db.update(students)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(students.id, userId));
  }
}

export const POST = requireRole(['EMPLOYEE', 'STAFF', 'STUDENT'], async (req: NextRequest, { session }) => {
  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { currentPassword, newPassword, returnTokens } = parsed.data;

  const user = await getPasswordHashForSession(session.role, session.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isValid = await verify(user.passwordHash, currentPassword);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid current password' }, { status: 400 });
  }

  const passwordHash = await hash(newPassword);
  await updatePasswordForSession(session.role, session.userId, passwordHash);
  await invalidateUserValidity(session.role, session.userId);

  await logAudit({
    institutionId: session.institutionId,
    actorId: session.userId,
    actorRole: session.role,
    action: 'CHANGE_PASSWORD',
    target: 'Self',
    ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
  });

  if (returnTokens) {
    const { accessToken, refreshToken } = await createTokens({
      userId: session.userId,
      role: session.role,
      institutionId: session.institutionId,
      campusId: session.campusId,
      mustChangePassword: false,
    });
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      message: 'Password changed successfully.',
      accessToken,
      refreshToken,
    });
  }

  return NextResponse.json({ message: 'Password changed successfully. Please login again to refresh session.' });
}, { allowPasswordChangeRequired: true });
