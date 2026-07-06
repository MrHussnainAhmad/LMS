import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { superAdmins, employees, institutions, staff, students } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { createTokens, setAuthCookies, UserRole } from '@/lib/auth';
import { withRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { loginSchema } from '@/lib/validators/auth';
import { sendEmail, LoginNotificationEmail } from '@/lib/email';

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

    const { emailOrUsername, password, securityAnswer } = parsed.data;
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

    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.email, emailOrUsername)).limit(1);
    if (admin) {
      if (!securityAnswer) {
        return NextResponse.json({ error: 'Security answer required for Super Admin' }, { status: 400 });
      }
      const isValidPassword = await verify(admin.passwordHash, password);
      const isValidAnswer = await verify(admin.securityAnswerHash, securityAnswer.toLowerCase().trim());
      if (isValidPassword && isValidAnswer) {
        user = admin;
        role = 'SUPER_ADMIN';
      }
    }

    if (!user) {
      const [emp] = await db.select().from(employees).where(eq(employees.email, emailOrUsername)).limit(1);
      if (emp) {
        const isValid = await verify(emp.passwordHash, password);
        if (isValid) {
          user = emp;
          role = 'EMPLOYEE';
          mustChangePassword = emp.mustChangePassword;
        }
      }
    }

    if (!user) {
      const [inst] = await db.select().from(institutions).where(eq(institutions.contactEmail, emailOrUsername)).limit(1);
      if (inst) {
        if (inst.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Institution account is not APPROVED' }, { status: 403 });
        }
        const isValid = await verify(inst.adminPasswordHash, password);
        if (isValid) {
          user = inst;
          role = 'INSTITUTION';
          institutionId = inst.id;
        }
      }
    }

    if (!user) {
      const [stf] = await db.select().from(staff).where(eq(staff.email, emailOrUsername)).limit(1);
      if (stf) {
        if (!stf.isActive) {
          return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
        }
        const isValid = await verify(stf.passwordHash, password);
        if (isValid) {
          user = stf;
          role = 'STAFF';
          institutionId = stf.institutionId;
          campusId = stf.campusId || undefined;
          mustChangePassword = stf.mustChangePassword;
        }
      }
    }

    if (!user) {
      const [stu] = await db.select().from(students).where(eq(students.loginRollNumber, emailOrUsername)).limit(1);
      if (stu) {
        if (!stu.isActive) {
          return NextResponse.json({ error: 'Account deactivated' }, { status: 403 });
        }
        const isValid = await verify(stu.passwordHash, password);
        if (isValid) {
          user = stu;
          role = 'STUDENT';
          institutionId = stu.institutionId;
          mustChangePassword = stu.mustChangePassword;
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

    return NextResponse.json({ message: 'Logged in successfully', role, mustChangePassword });
  } catch (err) {
    console.error('Login Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
