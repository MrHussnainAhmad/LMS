import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accountLockouts, superAdmins, employees, institutions, staff, students } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { createTokens, setAuthCookies, UserRole } from '@/lib/auth';
import { withRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { loginSchema } from '@/lib/validators/auth';
import { sendEmail, LoginNotificationEmail } from '@/lib/email';

const MAX_FAILED_LOGINS = Number(process.env.AUTH_LOCKOUT_MAX_FAILED || 5);
const LOCKOUT_WINDOW_MINUTES = Number(process.env.AUTH_LOCKOUT_WINDOW_MINUTES || 15);
const LOCKOUT_COOLDOWN_MINUTES = Number(process.env.AUTH_LOCKOUT_COOLDOWN_MINUTES || 15);

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

async function assertNotLocked(role: UserRole, userId: number) {
  const [lockout] = await db.select()
    .from(accountLockouts)
    .where(and(eq(accountLockouts.userRole, role), eq(accountLockouts.userId, userId)))
    .limit(1);

  if (lockout?.lockedUntil && lockout.lockedUntil > new Date()) {
    throw new Error(`Account temporarily locked until ${lockout.lockedUntil.toISOString()}`);
  }
}

async function clearFailedLogins(role: UserRole, userId: number) {
  const [lockout] = await db.select()
    .from(accountLockouts)
    .where(and(eq(accountLockouts.userRole, role), eq(accountLockouts.userId, userId)))
    .limit(1);
  if (!lockout) return;
  await db.update(accountLockouts)
    .set({ failedCount: 0, lockedUntil: null, windowStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(accountLockouts.id, lockout.id));
}

async function recordFailedLogin(role: UserRole, userId: number, institutionId: number | undefined, ip: string) {
  const now = new Date();
  const [existing] = await db.select()
    .from(accountLockouts)
    .where(and(eq(accountLockouts.userRole, role), eq(accountLockouts.userId, userId)))
    .limit(1);

  const insideWindow = existing && addMinutes(existing.windowStartedAt, LOCKOUT_WINDOW_MINUTES) > now;
  const failedCount = insideWindow ? existing.failedCount + 1 : 1;
  const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? addMinutes(now, LOCKOUT_COOLDOWN_MINUTES) : null;

  if (existing) {
    await db.update(accountLockouts)
      .set({
        failedCount,
        lockedUntil,
        windowStartedAt: insideWindow ? existing.windowStartedAt : now,
        updatedAt: now,
      })
      .where(eq(accountLockouts.id, existing.id));
  } else {
    await db.insert(accountLockouts).values({ userRole: role, userId, failedCount, lockedUntil, windowStartedAt: now, updatedAt: now });
  }

  if (lockedUntil) {
    await logAudit({
      institutionId,
      actorId: userId,
      actorRole: role,
      action: 'ACCOUNT_LOCKED',
      target: `User:${role}:${userId}`,
      ip,
    });
  }
}

async function rejectFailedLogin(role: UserRole, userId: number, institutionId: number | undefined, ip: string) {
  await recordFailedLogin(role, userId, institutionId, ip);
  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await withRateLimit(req, 'auth');
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { emailOrUsername, password, securityAnswer, returnTokens } = parsed.data;
    const loginIdentifier = emailOrUsername.trim().toLowerCase();
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = req.headers.get('user-agent') ?? 'Unknown';

    let user: any = null;
    let role: UserRole | null = null;
    let institutionId: number | undefined;
    let campusId: number | undefined;
    let mustChangePassword = false;

    // We check in order: SuperAdmin -> Employee -> Institution -> Staff -> Student
    // Realistically, the client should send the 'role' they are trying to log in as to avoid checking all tables,
    // but the prompt implies a single login flow or at least checking multiple.
    // For performance and correctness, we will check sequentially.

    const [admin] = await db.select().from(superAdmins).where(sql`lower(${superAdmins.email}) = ${loginIdentifier}`).limit(1);
    if (admin) {
      if (!securityAnswer) {
        return NextResponse.json({ error: 'Security answer required for Super Admin' }, { status: 400 });
      }
      await assertNotLocked('SUPER_ADMIN', admin.id);
      const isValidPassword = await verify(admin.passwordHash, password);
      const isValidAnswer = await verify(admin.securityAnswerHash, securityAnswer.toLowerCase().trim());
      if (isValidPassword && isValidAnswer) {
        user = admin;
        role = 'SUPER_ADMIN';
      } else {
        return await rejectFailedLogin('SUPER_ADMIN', admin.id, undefined, ip);
      }
    }

    if (!user) {
      const [emp] = await db.select().from(employees).where(sql`lower(${employees.email}) = ${loginIdentifier}`).limit(1);
      if (emp) {
        await assertNotLocked('EMPLOYEE', emp.id);
        const isValid = await verify(emp.passwordHash, password);
        if (isValid) {
          user = emp;
          role = 'EMPLOYEE';
          mustChangePassword = emp.mustChangePassword;
        } else {
          return await rejectFailedLogin('EMPLOYEE', emp.id, undefined, ip);
        }
      }
    }

    if (!user) {
      const [inst] = await db.select().from(institutions).where(sql`lower(${institutions.contactEmail}) = ${loginIdentifier}`).limit(1);
      if (inst) {
        if (inst.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Institution account is not APPROVED' }, { status: 403 });
        }
        await assertNotLocked('INSTITUTION', inst.id);
        const isValid = await verify(inst.adminPasswordHash, password);
        if (isValid) {
          user = inst;
          role = 'INSTITUTION';
          institutionId = inst.id;
        } else {
          return await rejectFailedLogin('INSTITUTION', inst.id, inst.id, ip);
        }
      }
    }

    if (!user) {
      const [stf] = await db.select().from(staff).where(sql`lower(${staff.email}) = ${loginIdentifier}`).limit(1);
      if (stf) {
        if (!stf.isActive) {
          return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
        }
        await assertNotLocked('STAFF', stf.id);
        const isValid = await verify(stf.passwordHash, password);
        if (isValid) {
          user = stf;
          role = 'STAFF';
          institutionId = stf.institutionId;
          campusId = stf.campusId || undefined;
          mustChangePassword = stf.mustChangePassword;
        } else {
          return await rejectFailedLogin('STAFF', stf.id, stf.institutionId, ip);
        }
      }
    }

    if (!user) {
      const [stu] = await db.select().from(students).where(sql`lower(${students.loginRollNumber}) = ${loginIdentifier}`).limit(1);
      if (stu) {
        if (!stu.isActive) {
          return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
        }
        await assertNotLocked('STUDENT', stu.id);
        const isValid = await verify(stu.passwordHash, password);
        if (isValid) {
          user = stu;
          role = 'STUDENT';
          institutionId = stu.institutionId;
          mustChangePassword = stu.mustChangePassword;
        } else {
          return await rejectFailedLogin('STUDENT', stu.id, stu.institutionId, ip);
        }
      }
    }

    if (!user || !role) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const { accessToken, refreshToken } = await createTokens({
      userId: user.id,
      role,
      institutionId,
      campusId,
      mustChangePassword,
    });

    await setAuthCookies(accessToken, refreshToken);
    await clearFailedLogins(role, user.id);

    await logAudit({
      institutionId,
      actorId: user.id,
      actorRole: role,
      action: 'LOGIN',
      target: 'Self',
      ip,
    });

    if (role === 'EMPLOYEE') {
      await sendEmail({
        to: user.email,
        subject: 'New Login Detected',
        html: LoginNotificationEmail({
          ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
          userAgent: req.headers.get('user-agent') ?? 'Unknown',
          time: new Date().toISOString(),
        }),
      });
    }

    return NextResponse.json({
      message: 'Logged in successfully',
      role,
      mustChangePassword,
      ...(returnTokens ? { accessToken, refreshToken } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Account temporarily locked')) {
      return NextResponse.json({ error: err.message }, { status: 423 });
    }
    console.error('Login Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
