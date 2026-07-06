import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, institutions, classes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { createStudentSchema } from '@/lib/validators/student';
import { logAudit } from '@/lib/audit';

export const POST = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const body = await req.json();
  const parsed = createStudentSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { firstName, lastName, campusId, classId, sectionId, gender, yearOfJoining, classRollNumber, phone, age } = parsed.data;

  const [inst] = await db.select().from(institutions).where(eq(institutions.id, tenantId)).limit(1);
  const [classObj] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);

  if (!classObj) {
    return NextResponse.json({ error: "Class not found" }, { status: 400 });
  }

  // Extract digits from class name, e.g. "9", "10", "Pre-9th" -> "9". 
  const classNumberMatch = classObj.name.match(/\d+/);
  const classNumberStr = classNumberMatch ? classNumberMatch[0] : classObj.name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  
  // yearOfJoining last two digits:
  const yearLastTwo = yearOfJoining.toString().slice(-2);

  // roll number logic: {S|C|U}{year}{classLevel}{roll}@{username}.myapp.pk
  const typeLetter = inst.type.charAt(0).toUpperCase();
  const loginRollNumber = `${typeLetter}${yearLastTwo}${classNumberStr}${classRollNumber}@${inst.username}.${process.env.APP_DOMAIN || 'myapp.pk'}`;

  const initialPassword = '1234567890';
  const passwordHash = await hash(initialPassword);

  const name = `${firstName} ${lastName}`.trim();

  try {
    const [newStudent] = await db.insert(students).values({
      institutionId: tenantId,
      campusId,
      name,
      gender,
      loginRollNumber,
      passwordHash,
      classId,
      sectionId,
      yearOfJoining,
      classRollNumber,
      phone,
      age,
      mustChangePassword: true,
      isActive: true,
    }).returning();

    await logAudit({
      institutionId: tenantId,
      actorId: session.userId,
      actorRole: session.role,
      action: 'CREATE_STUDENT',
      target: `Student ${newStudent.id}`,
      ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
    });

    return NextResponse.json({ 
      message: 'Student created successfully', 
      credentials: { loginRollNumber, initialPassword } 
    }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === '23505') {
      return NextResponse.json({ error: 'Login roll number or class roll number already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
