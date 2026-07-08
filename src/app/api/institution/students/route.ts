import { after, NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, institutions, classes, sections } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { createStudentSchema } from '@/lib/validators/student';
import { logAudit } from '@/lib/audit';
import { generateStudentLoginRollNumber } from '@/lib/login-identifiers';

const WHOLE_CLASS_SECTION_NAME = "Whole Class";

async function getOrCreateWholeClassSection(institutionId: number, classId: number) {
  const [existingSection] = await db.select({
    id: sections.id,
    classId: sections.classId,
    name: sections.name,
  })
    .from(sections)
    .where(and(
      eq(sections.classId, classId),
      eq(sections.institutionId, institutionId),
      eq(sections.name, WHOLE_CLASS_SECTION_NAME)
    ))
    .limit(1);

  if (existingSection) return existingSection;

  const [createdSection] = await db.insert(sections).values({
    institutionId,
    classId,
    name: WHOLE_CLASS_SECTION_NAME,
    classTeacherId: null,
  }).returning({
    id: sections.id,
    classId: sections.classId,
    name: sections.name,
  });

  return createdSection;
}

export const POST = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  try {
    const tenantId = getTenantContext(session);
    const body = await req.json();
    const parsed = createStudentSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { firstName, lastName, campusId, classId, sectionId, gender, yearOfJoining, classRollNumber, phone, age } = parsed.data;

    const [[inst], [classObj], sectionRows] = await Promise.all([
      db.select({
        id: institutions.id,
        type: institutions.type,
        username: institutions.username,
      }).from(institutions).where(eq(institutions.id, tenantId)).limit(1),
      db.select({
        id: classes.id,
        name: classes.name,
      }).from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, tenantId))).limit(1),
      sectionId ? db.select({
        id: sections.id,
        classId: sections.classId,
        name: sections.name,
      }).from(sections).where(and(eq(sections.id, sectionId), eq(sections.institutionId, tenantId))).limit(1) : Promise.resolve([]),
    ]);

    if (!inst) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    if (!classObj) {
      return NextResponse.json({ error: "Class not found" }, { status: 400 });
    }

    const sectionObj = sectionRows[0] ?? await getOrCreateWholeClassSection(tenantId, classId);

    if (!sectionObj || sectionObj.classId !== classId) {
      return NextResponse.json({ error: "Section not found for selected class" }, { status: 400 });
    }

    const loginRollNumber = generateStudentLoginRollNumber({
      institution: inst,
      classRow: classObj,
      sectionRow: sectionObj,
      yearOfJoining,
      classRollNumber,
    });

    const initialPassword = '1234567890';
    const passwordHash = await hash(initialPassword);
    const name = `${firstName} ${lastName}`.trim();

    const [newStudent] = await db.insert(students).values({
      institutionId: tenantId,
      campusId,
      name,
      gender,
      loginRollNumber,
      passwordHash,
      classId,
      sectionId: sectionObj.id,
      yearOfJoining,
      classRollNumber,
      phone,
      age,
      mustChangePassword: true,
      isActive: true,
    }).returning({ id: students.id });

    after(async () => {
      try {
        await logAudit({
          institutionId: tenantId,
          actorId: session.userId,
          actorRole: session.role,
          action: 'CREATE_STUDENT',
          target: `Student ${newStudent.id}`,
          ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
        });
      } catch (auditError) {
        console.error("Create student audit failed:", auditError);
      }
    });

    return NextResponse.json({ 
      message: 'Student created successfully', 
    credentials: { loginRollNumber, initialPassword } 
    }, { status: 201 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'code' in err && err.code === '23505') {
      return NextResponse.json({ error: 'Login roll number or class roll number already exists' }, { status: 409 });
    }
    console.error("Create student failed:", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
