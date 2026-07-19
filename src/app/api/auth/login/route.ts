import { after, NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accountLockouts, auditLogs, superAdmins, employees, institutions, staff, students, institutionAdmins } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { verifyPassword as verify } from '@/lib/argon2-pool';
import { createTokens, setAuthCookies, UserRole } from '@/lib/auth';
import { JWTPayload } from '@/lib/auth-types';
import { PlatformLoginKind, withPlatformLoginRateLimit, withRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { loginSchema } from '@/lib/validators/auth';
import { sendEmail, LoginNotificationEmail } from '@/lib/email';
import { getUserCreatedAt } from '@/lib/user';

const MAX_FAILED_LOGINS = Number(process.env.AUTH_LOCKOUT_MAX_FAILED || 5);
const LOCKOUT_WINDOW_MINUTES = Number(process.env.AUTH_LOCKOUT_WINDOW_MINUTES || 15);
const LOCKOUT_COOLDOWN_MINUTES = Number(process.env.AUTH_LOCKOUT_COOLDOWN_MINUTES || 15);
const LOGIN_LOOKUP_ORDER: UserRole[] = ['STUDENT', 'STAFF', 'INSTITUTION', 'INSTITUTION_ADMIN', 'EMPLOYEE', 'SUPER_ADMIN'];

type LoginCandidate = {
  role: UserRole;
  id: number;
  password_hash: string;
  security_answer_hash: string | null;
  is_super_admin: boolean | null;
  is_active: boolean | null;
  institution_id: number | null;
  campus_id: number | null;
  must_change_password: boolean | null;
  account_status: string | null;
  email: string | null;
  contact_email: string | null;
};

type SuperAdminLogin = { id: number; email?: string; passwordHash: string; securityAnswerHash: string; isSuperAdmin: boolean };
type EmployeeLogin = { id: number; email: string; passwordHash: string; mustChangePassword: boolean };
type InstitutionLogin = { id: number; contactEmail: string; adminPasswordHash: string; status: string };
type InstitutionAdminLogin = { id: number; email?: string; passwordHash: string; institutionId: number };
type StaffLogin = { id: number; email?: string; passwordHash: string; isActive: boolean; institutionId: number; campusId: number | null; mustChangePassword: boolean };
type StudentLogin = { id: number; loginRollNumber?: string; passwordHash: string; isActive: boolean; institutionId: number; mustChangePassword: boolean };

async function findUnhintedLoginCandidate(loginIdentifier: string): Promise<LoginCandidate | null> {
  const result = await db.execute(sql`
    WITH login_input AS (
      SELECT ${loginIdentifier}::text AS identifier
    ),
    candidates AS (
      SELECT 'STUDENT'::text AS role, 1 AS priority, s.id, s.password_hash,
        NULL::text AS security_answer_hash, NULL::boolean AS is_super_admin,
        s.is_active, s.institution_id, NULL::integer AS campus_id,
        s.must_change_password, NULL::text AS account_status,
        NULL::text AS email, NULL::text AS contact_email
      FROM students AS s CROSS JOIN login_input AS i
      WHERE lower(s.login_roll_number) = i.identifier

      UNION ALL

      SELECT 'STAFF'::text, 2, s.id, s.password_hash,
        NULL::text, NULL::boolean, s.is_active, s.institution_id, s.campus_id,
        s.must_change_password, NULL::text, NULL::text, NULL::text
      FROM staff AS s CROSS JOIN login_input AS i
      WHERE lower(s.email) = i.identifier

      UNION ALL

      SELECT 'INSTITUTION'::text, 3, i2.id, i2.admin_password_hash,
        NULL::text, NULL::boolean, NULL::boolean, i2.id, NULL::integer,
        NULL::boolean, i2.status::text, NULL::text, i2.contact_email::text
      FROM institutions AS i2 CROSS JOIN login_input AS i
      WHERE lower(i2.contact_email) = i.identifier

      UNION ALL

      SELECT 'INSTITUTION_ADMIN'::text, 4, ia.id, ia.password_hash,
        NULL::text, NULL::boolean, NULL::boolean, ia.institution_id, NULL::integer,
        NULL::boolean, NULL::text, NULL::text, NULL::text
      FROM institution_admins AS ia CROSS JOIN login_input AS i
      WHERE lower(ia.email) = i.identifier

      UNION ALL

      SELECT 'EMPLOYEE'::text, 5, e.id, e.password_hash,
        NULL::text, NULL::boolean, NULL::boolean, NULL::integer, NULL::integer,
        e.must_change_password, NULL::text, e.email::text, NULL::text
      FROM employees AS e CROSS JOIN login_input AS i
      WHERE lower(e.email) = i.identifier

      UNION ALL

      SELECT 'SUPER_ADMIN'::text, 6, sa.id, sa.password_hash,
        sa.security_answer_hash, sa.is_super_admin, NULL::boolean, NULL::integer,
        NULL::integer, NULL::boolean, NULL::text, NULL::text, NULL::text
      FROM super_admins AS sa CROSS JOIN login_input AS i
      WHERE lower(sa.email) = i.identifier
    )
    SELECT role, id, password_hash, security_answer_hash, is_super_admin, is_active,
      institution_id, campus_id, must_change_password, account_status, email, contact_email
    FROM candidates
    ORDER BY priority
    LIMIT 1
  `);

  return (result.rows[0] as LoginCandidate | undefined) ?? null;
}

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
  if (roleHint === 'INSTITUTION') return ['INSTITUTION', 'INSTITUTION_ADMIN'] as UserRole[];
  if (roleHint === 'STAFF') return ['STAFF', 'INSTITUTION_ADMIN'] as UserRole[];
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

    let user: { id: number; email?: string; contactEmail?: string; isSuperAdmin?: boolean } | null = null;
    let role: UserRole | null = null;
    let institutionId: number | undefined;
    let campusId: number | undefined;
    let mustChangePassword = false;

    const { redis } = await import('@/lib/redis');
    const cacheKey = `auth:role:${loginIdentifier}`;
    const cachedRole = await redis.get(cacheKey).catch(() => null);
    
    const hasUsableCachedRole = Boolean(cachedRole && lookupRoles.includes(cachedRole as UserRole));
    if (hasUsableCachedRole) {
      const idx = lookupRoles.indexOf(cachedRole as UserRole);
      lookupRoles.splice(idx, 1);
      lookupRoles.unshift(cachedRole as UserRole);
    }

    let admin: SuperAdminLogin | undefined;
    let emp: EmployeeLogin | undefined;
    let inst: InstitutionLogin | undefined;
    let instAdmin: InstitutionAdminLogin | undefined;
    let stf: StaffLogin | undefined;
    let stu: StudentLogin | undefined;
    
    if (!roleHint && !hasUsableCachedRole) {
      const candidate = await findUnhintedLoginCandidate(loginIdentifier);

      if (candidate?.role === 'SUPER_ADMIN') {
        admin = {
          id: candidate.id,
          passwordHash: candidate.password_hash,
          securityAnswerHash: candidate.security_answer_hash!,
          isSuperAdmin: candidate.is_super_admin!,
        };
      } else if (candidate?.role === 'EMPLOYEE') {
        emp = {
          id: candidate.id,
          email: candidate.email!,
          passwordHash: candidate.password_hash,
          mustChangePassword: candidate.must_change_password!,
        };
      } else if (candidate?.role === 'INSTITUTION') {
        inst = {
          id: candidate.id,
          contactEmail: candidate.contact_email!,
          adminPasswordHash: candidate.password_hash,
          status: candidate.account_status!,
        };
      } else if (candidate?.role === 'INSTITUTION_ADMIN') {
        instAdmin = {
          id: candidate.id,
          passwordHash: candidate.password_hash,
          institutionId: candidate.institution_id!,
        };
      } else if (candidate?.role === 'STAFF') {
        stf = {
          id: candidate.id,
          passwordHash: candidate.password_hash,
          isActive: candidate.is_active!,
          institutionId: candidate.institution_id!,
          campusId: candidate.campus_id,
          mustChangePassword: candidate.must_change_password!,
        };
      } else if (candidate?.role === 'STUDENT') {
        stu = {
          id: candidate.id,
          passwordHash: candidate.password_hash,
          isActive: candidate.is_active!,
          institutionId: candidate.institution_id!,
          mustChangePassword: candidate.must_change_password!,
        };
      }
    } else for (const lookupRole of lookupRoles) {
      if (lookupRole === 'SUPER_ADMIN') {
        const rows = await db.select({
          id: superAdmins.id,
          email: superAdmins.email,
          passwordHash: superAdmins.passwordHash,
          securityAnswerHash: superAdmins.securityAnswerHash,
          isSuperAdmin: superAdmins.isSuperAdmin,
        }).from(superAdmins).where(sql`lower(${superAdmins.email}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          admin = rows[0];
          break;
        }
      } else if (lookupRole === 'EMPLOYEE') {
        const rows = await db.select({
          id: employees.id,
          email: employees.email,
          passwordHash: employees.passwordHash,
          mustChangePassword: employees.mustChangePassword,
        }).from(employees).where(sql`lower(${employees.email}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          emp = rows[0];
          break;
        }
      } else if (lookupRole === 'INSTITUTION') {
        const rows = await db.select({
          id: institutions.id,
          contactEmail: institutions.contactEmail,
          adminPasswordHash: institutions.adminPasswordHash,
          status: institutions.status,
        }).from(institutions).where(sql`lower(${institutions.contactEmail}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          inst = rows[0];
          break;
        }
      } else if (lookupRole === 'INSTITUTION_ADMIN') {
        const rows = await db.select({
          id: institutionAdmins.id,
          email: institutionAdmins.email,
          passwordHash: institutionAdmins.passwordHash,
          institutionId: institutionAdmins.institutionId,
        }).from(institutionAdmins).where(sql`lower(${institutionAdmins.email}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          instAdmin = rows[0];
          break;
        }
      } else if (lookupRole === 'STAFF') {
        const rows = await db.select({
          id: staff.id,
          email: staff.email,
          passwordHash: staff.passwordHash,
          isActive: staff.isActive,
          institutionId: staff.institutionId,
          campusId: staff.campusId,
          mustChangePassword: staff.mustChangePassword,
        }).from(staff).where(sql`lower(${staff.email}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          stf = rows[0];
          break;
        }
      } else if (lookupRole === 'STUDENT') {
        const rows = await db.select({
          id: students.id,
          loginRollNumber: students.loginRollNumber,
          passwordHash: students.passwordHash,
          isActive: students.isActive,
          institutionId: students.institutionId,
          mustChangePassword: students.mustChangePassword,
        }).from(students).where(sql`lower(${students.loginRollNumber}) = ${loginIdentifier}`).limit(1);
        if (rows.length > 0) {
          stu = rows[0];
          break;
        }
      }
    }

    let platformLoginKind: PlatformLoginKind | null = null;
    if (admin) {
      platformLoginKind = admin.isSuperAdmin ? 'super-admin' : 'mini-admin';
    } else if (emp || roleHint === 'EMPLOYEE') {
      platformLoginKind = 'employee';
    } else if (roleHint === 'SUPER_ADMIN') {
      // Unknown admin identifiers get the strictest limit to prevent enumeration
      // from weakening protection on the Super Admin login route.
      platformLoginKind = 'super-admin';
    }

    const rateLimit = platformLoginKind
      ? await withPlatformLoginRateLimit(req, platformLoginKind, loginIdentifier)
      : await withRateLimit(req, 'auth');

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in one minute.' },
        { status: 429 },
      );
    }

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
    } else if (instAdmin) {
      await assertNotLocked('INSTITUTION_ADMIN', instAdmin.id);
      const isValid = await verify(instAdmin.passwordHash, password);
      if (isValid) {
        user = instAdmin;
        role = 'INSTITUTION_ADMIN';
        institutionId = instAdmin.institutionId;
      } else {
        return await rejectFailedLogin('INSTITUTION_ADMIN', instAdmin.id, instAdmin.institutionId, ip);
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

    if (redis.status === 'ready') {
      await redis.setex(cacheKey, 300, role).catch(() => null);
    }

    const createdAt = (await getUserCreatedAt({ userId: user.id, role, institutionId })).toISOString();

    const payload: JWTPayload = {
      userId: user.id,
      role,
      institutionId,
      campusId,
      mustChangePassword,
      isSuperAdmin: role === 'SUPER_ADMIN' ? user.isSuperAdmin : undefined,
      createdAt,
    };

    const [{ accessToken, refreshToken }] = await Promise.all([
      createTokens(payload),
      clearFailedLogins(role, user.id),
    ]);

    await setAuthCookies(accessToken, refreshToken);

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
