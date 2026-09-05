import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { classes, sections, staff, subjects } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (_req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const [subjectRows, classRows, sectionRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name, code: subjects.code }).from(subjects)
      .where(and(eq(subjects.institutionId, institutionId), isNull(subjects.deletedAt))).orderBy(asc(subjects.name)),
    db.select({ id: classes.id, name: classes.name, level: classes.level, isFinalClass: classes.isFinalClass }).from(classes)
      .where(and(eq(classes.institutionId, institutionId), eq(classes.isGraduatedArchive, false), isNull(classes.deletedAt))).orderBy(asc(classes.level), asc(classes.name)),
    db.select({ id: sections.id, classId: sections.classId, name: sections.name, classTeacherId: sections.classTeacherId, classTeacherName: staff.name })
      .from(sections).leftJoin(staff, and(eq(staff.id, sections.classTeacherId), eq(staff.institutionId, institutionId)))
      .where(and(eq(sections.institutionId, institutionId), isNull(sections.deletedAt))).orderBy(asc(sections.name)),
  ]);
  return NextResponse.json({ subjects: subjectRows, classes: classRows, sections: sectionRows }, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 }); }
  const action = String(body.action || '');

  if (action === 'createSubject') {
    const names = Array.from(new Map(
      String(body.name || '').split(',').map((name) => name.trim()).filter(Boolean).map((name) => [name.toLocaleLowerCase(), name]),
    ).values());
    const code = String(body.code || '').trim();
    if (names.length === 0 || names.length > 50 || names.some((name) => name.length > 255) || code.length > 50) return NextResponse.json({ error: 'Enter between 1 and 50 valid subject names' }, { status: 400 });
    if (names.length > 1 && code) return NextResponse.json({ error: 'Leave subject code empty when adding multiple subjects' }, { status: 400 });
    const existing = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.institutionId, institutionId));
    const existingNames = new Set(existing.map((subject) => subject.name.trim().toLocaleLowerCase()));
    const newNames = names.filter((name) => !existingNames.has(name.toLocaleLowerCase()));
    if (newNames.length === 0) return NextResponse.json({ error: 'All entered subjects already exist' }, { status: 409 });
    await db.insert(subjects).values(newNames.map((name) => ({ institutionId, name, code: names.length === 1 ? code || null : null })));
    return NextResponse.json({ message: `${newNames.length} subject${newNames.length === 1 ? '' : 's'} created`, created: newNames.length }, { status: 201 });
  }

  if (action === 'createClass') {
    const name = String(body.name || '').trim();
    const level = Number(body.level || 0);
    const isFinalClass = body.isFinalClass === true;
    if (name.length < 1 || name.length > 100 || !Number.isInteger(level) || level < 0 || level > 100) return NextResponse.json({ error: 'Enter a valid class name and level' }, { status: 400 });
    await db.transaction(async (tx) => {
      if (isFinalClass) await tx.update(classes).set({ isFinalClass: false }).where(eq(classes.institutionId, institutionId));
      const [created] = await tx.insert(classes).values({ institutionId, name, level, isFinalClass }).returning({ id: classes.id });
      await tx.insert(sections).values({ institutionId, classId: created.id, name: 'Whole Class' });
    });
    return NextResponse.json({ message: 'Class created' }, { status: 201 });
  }

  if (action === 'createSection') {
    const name = String(body.name || '').trim();
    const classId = Number(body.classId);
    const classTeacherId = body.classTeacherId ? Number(body.classTeacherId) : null;
    if (!/^[A-Za-z0-9]$/.test(name) || !Number.isInteger(classId) || classId <= 0) return NextResponse.json({ error: 'Section must be one letter or number' }, { status: 400 });
    const [classRow] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId), eq(classes.isGraduatedArchive, false))).limit(1);
    if (!classRow) return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    if (classTeacherId) {
      const [teacher] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, classTeacherId), eq(staff.institutionId, institutionId), eq(staff.isActive, true))).limit(1);
      if (!teacher) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }
    await db.insert(sections).values({ institutionId, classId, name: name.toUpperCase(), classTeacherId });
    return NextResponse.json({ message: 'Section created' }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unsupported academics action' }, { status: 400 });
});
