import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employees, staff, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { requireRole } from '@/lib/rbac';
import { changePasswordSchema } from '@/lib/validators/auth';
import { logAudit } from '@/lib/audit';

export const POST = requireRole(['EMPLOYEE', 'STAFF', 'STUDENT'], async (req: NextRequest, { session }) => {
  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  let userTable: any;
  if (session.role === 'EMPLOYEE') userTable = employees;
  else if (session.role === 'STAFF') userTable = staff;
  else if (session.role === 'STUDENT') userTable = students;

  const [user] = await db.select().from(userTable).where(eq(userTable.id, session.userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isValid = await verify(user.passwordHash, currentPassword);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid current password' }, { status: 400 });
  }

  const passwordHash = await hash(newPassword);

  await db.update(userTable)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(userTable.id, session.userId));

  await logAudit({
    institutionId: session.institutionId,
    actorId: session.userId,
    actorRole: session.role,
    action: 'CHANGE_PASSWORD',
    target: 'Self',
    ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
  });

  return NextResponse.json({ message: 'Password changed successfully. Please login again to refresh session.' });
}, { allowPasswordChangeRequired: true });
