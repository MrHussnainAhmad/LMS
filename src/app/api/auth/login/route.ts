import { after, NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accountLockouts, auditLogs, superAdmins, employees, institutions, staff, students } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { createTokens, setAuthCookies, UserRole } from '@/lib/auth';
import { JWTPayload } from '@/lib/auth-types';
import { withRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { loginSchema } from '@/lib/validators/auth';
import { sendEmail, LoginNotificationEmail } from '@/lib/email';

const MAX_FAILED_LOGINS = Number(process.env.AUTH_LOCKOUT_MAX_FAILED || 5);
const LOCKOUT_WINDOW_MINUTES = Number(process.env.AUTH_LOCKOUT_WINDOW_MINUTES || 15);
const LOCKOUT_COOLDOWN_MINUTES = Number(process.env.AUTH_LOCKOUT_COOLDOWN_MINUTES || 15);
const LOGIN_LOOKUP_ORDER: UserRole[] = ['SUPER_ADMIN', 'EMPLOYEE', 'INSTITUTION', 'STAFF', 'STUDENT'];

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

function getLoginLookupRoles(roleHint?: UserRole) {
  return roleHint ? [roleHint] : LOGIN_LOOKUP_ORDER;
}

async function runPostLoginSideEffects(params: {
  role: UserRole;
  user: { id: number; email?: string; contactEmail?: string };
  institutionId?: number;
  ip: string;
  userAgent: string;
}) {
  const { role, user, institutionId, ip, userAgent } = params;
  const shouldSendLoginEmail = role === 'EMPLOYEE' || role === 'INSTITUTION';

  try {
    const previousLogin = shouldSendLoginEmail ? await db.select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.actorId, user.id),
        eq(auditLogs.actorRole, role),
        eq(auditLogs.action, 'LOGIN')
      ))
      .limit(1) : [];

    await logAudit({
      institutionId,
      actorId: user.id,
      actorRole: role,
      action: 'LOGIN',
      target: 'Self',
      ip,
    });

    if (!shouldSendLoginEmail) return;

    const loginEmail = role === 'EMPLOYEE' ? user.email : user.contactEmail;
    const isFirstLogin = previousLogin.length === 0;

    if (loginEmail) {
      await sendEmail({
        to: loginEmail,
        subject: isFirstLogin ? 'New Login Detected' : 'Login Alert',
        html: LoginNotificationEmail({
          ip,
          userAgent,
          time: new Date().toISOString(),
          isFirstLogin,
        }),
      });
    }
  } catch (err) {
    console.error('Post-login side effect failed:', err);
  }
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

    const { emailOrUsername, password, roleHint, securityAnswer, returnTokens } = parsed.data;
    const loginIdentifier = emailOrUsername.trim().toLowerCase();
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const userAgent = req.headers.get('user-agent') ?? 'Unknown';
    const lookupRoles = getLoginLookupRoles(roleHint);

    let user: { id: number; email?: string; contactEmail?: string } | null = null;
    let role: UserRole | null = null;
    let institutionId: number | undefined;
    let campusId: number | undefined;
    let mustChangePassword = false;

    const lookupResults = await Promise.all(
      lookupRoles.map(async (lookupRole) => {
        switch (lookupRole) {
          case 'SUPER_ADMIN':
            return {
              role: lookupRole,
              rows: await db.select({
                id: superAdmins.id,
                email: superAdmins.email,
                passwordHash: superAdmins.passwordHash,
                securityAnswerHash: superAdmins.securityAnswerHash,
                isSuperAdmin: superAdmins.isSuperAdmin,
              }).from(superAdmins).where(sql`lower(${superAdmins.email}) = ${loginIdentifier}`).limit(1),
            };
          case 'EMPLOYEE':
            return {
              role: lookupRole,
              rows: await db.select({
                id: employees.id,
                email: employees.email,
                passwordHash: employees.passwordHash,
                mustChangePassword: employees.mustChangePassword,
              }).from(employees).where(sql`lower(${employees.email}) = ${loginIdentifier}`).limit(1),
            };
          case 'INSTITUTION':
            return {
              role: lookupRole,
              rows: await db.select({
                id: institutions.id,
                contactEmail: institutions.contactEmail,
                adminPasswordHash: institutions.adminPasswordHash,
                status: institutions.status,
              }).from(institutions).where(sql`lower(${institutions.contactEmail}) = ${loginIdentifier}`).limit(1),
            };
          case 'STAFF':
            return {
              role: lookupRole,
              rows: await db.select({
                id: staff.id,
                email: staff.email,
                passwordHash: staff.passwordHash,
                isActive: staff.isActive,
                institutionId: staff.institutionId,
                campusId: staff.campusId,
                mustChangePassword: staff.mustChangePassword,
              }).from(staff).where(sql`lower(${staff.email}) = ${loginIdentifier}`).limit(1),
            };
          case 'STUDENT':
            return {
              role: lookupRole,
              rows: await db.select({
                id: students.id,
                loginRollNumber: students.loginRollNumber,
                passwordHash: students.passwordHash,
                isActive: students.isActive,
                institutionId: students.institutionId,
                mustChangePassword: students.mustChangePassword,
              }).from(students).where(sql`lower(${students.loginRollNumber}) = ${loginIdentifier}`).limit(1),
            };
        }
      })
    );

    const admin = lookupResults.find((result) => result.role === 'SUPER_ADMIN')?.rows[0];
    const emp = lookupResults.find((result) => result.role === 'EMPLOYEE')?.rows[0];
    const inst = lookupResults.find((result) => result.role === 'INSTITUTION')?.rows[0];
    const stf = lookupResults.find((result) => result.role === 'STAFF')?.rows[0];
    const stu = lookupResults.find((result) => result.role === 'STUDENT')?.rows[0];

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
    } else if (emp) {
      await assertNotLocked('EMPLOYEE', emp.id);
      const isValid = await verify(emp.passwordHash, password);
      if (isValid) {
        user = emp;
        role = 'EMPLOYEE';
        mustChangePassword = emp.mustChangePassword;
      } else {
        return await rejectFailedLogin('EMPLOYEE', emp.id, undefined, ip);
      }
    } else if (inst) {
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
    } else if (stf) {
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
    } else if (stu) {
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

    if (!user || !role) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const payload: JWTPayload = {
      userId: user.id,
      role,
      institutionId,
      campusId,
      mustChangePassword,
      isSuperAdmin: role === 'SUPER_ADMIN' ? (user as any).isSuperAdmin : undefined,
    };

    const { accessToken, refreshToken } = await createTokens(payload);

    await setAuthCookies(accessToken, refreshToken);
    await clearFailedLogins(role, user.id);

    after(() => runPostLoginSideEffects({
      role,
      user,
      institutionId,
      ip,
      userAgent,
    }));

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
