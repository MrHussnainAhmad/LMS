import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staff, staffTeachableSubjects, institutions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword as hash } from '@/lib/argon2-pool';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { createStaffSchema } from '@/lib/validators/staff';
import { logAudit } from '@/lib/audit';
import { generateStaffEmail } from '@/lib/login-identifiers';

export const POST = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const body = await req.json();
  const parsed = createStaffSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, phone, subjectIds, campusId } = parsed.data;

  const [inst] = await db.select().from(institutions).where(eq(institutions.id, tenantId)).limit(1);
  if (!inst) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  const baseEmail = generateStaffEmail({ name, phone, institution: inst });
  const [localPart, domain] = baseEmail.split('@');
  let generatedEmail = baseEmail;
  
  // collision check
  let count = 0;
  while (true) {
    const [existing] = await db.select().from(staff).where(eq(staff.email, generatedEmail)).limit(1);
    if (!existing) break;
    count++;
    generatedEmail = `${localPart}${count}@${domain}`;
  }

  const initialPassword = '1234567890';
  const passwordHash = await hash(initialPassword);

  try {
    const [newStaff] = await db.insert(staff).values({
      institutionId: tenantId,
      campusId: campusId || null,
      name,
      email: generatedEmail,
      phone,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    }).returning();

    if (subjectIds.length > 0) {
      await db.insert(staffTeachableSubjects).values(
        subjectIds.map(id => ({
          institutionId: tenantId,
          staffId: newStaff.id,
          subjectId: id,
        }))
      );
    }

    await logAudit({
      institutionId: tenantId,
      actorId: session.userId,
      actorRole: session.role,
      action: 'CREATE_STAFF',
      target: `Staff ${newStaff.id}`,
      ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
    });

    try {
      const { redis } = await import('@/lib/redis');
      await redis.del(`cache:dashboard:${tenantId}`);
    } catch (e) {
      // ignore
    }

    // We realistically can't email the staff because it's a generated internal email unless we use 'phone' or SMS. 
    // Usually, the institution admin hands the credentials. But if there's a real email, we send it.
    // We will just return the credentials.
    return NextResponse.json({ 
      message: 'Staff created successfully', 
      credentials: { email: generatedEmail, initialPassword } 
    }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
