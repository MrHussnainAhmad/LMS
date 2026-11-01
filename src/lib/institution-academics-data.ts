import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { academicSessions, auditLogs, classes, feeInvoices, sections, staff, students, subjects } from '@/db/schema';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ActionInputError } from './action-input-error';
import type { JWTPayload } from './auth-types';
import { assertCampusWritable } from './campus-view';
import { jsonRows } from './dashboard-data';
import { getCachedOrFetch, invalidateReadCacheKeys, invalidateReadCachePatterns } from './redis';
import { academicCacheKey } from './cache-policy';

/** Shared by SSR, academics API and section pickers; teacher labels bound this to 30 seconds. */
export async function getInstitutionAcademicsData(institutionId: number) {
  return getCachedOrFetch(academicCacheKey(institutionId), 30, () => fetchInstitutionAcademicsData(institutionId));
}

export async function invalidateInstitutionAcademicsCache(institutionId: number) {
  try {
    await invalidateReadCacheKeys([academicCacheKey(institutionId)]);
    await invalidateReadCachePatterns([`cache:student-picker:${institutionId}:*`]);
  }
  catch (error) { console.warn('Academic cache invalidation failed:', error); }
}

export async function rolloverAcademicSession(session: JWTPayload, input: unknown, apply = false) {
  assertCampusWritable(session);
  if (!session.institutionId || !['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role) || session.mustChangePassword) throw new ActionInputError('Forbidden');
  const value = z.object({ name: z.string().trim().min(2).max(50), startDate: z.string().date(), endDate: z.string().date(),
    expectedPreviewHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), rolloverId: z.string().uuid().optional(), confirm: z.boolean().optional() }).parse(input);
  if (value.startDate >= value.endDate) throw new ActionInputError('The session end date must follow its start date.');
  const institutionId = session.institutionId;
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(80428, ${institutionId})`);
    const sessions = await tx.select().from(academicSessions).where(eq(academicSessions.institutionId, institutionId)).orderBy(asc(academicSessions.id));
    const previous=apply&&value.rolloverId?sessions.find(row=>row.record.rolloverId===value.rolloverId):undefined;
    if(previous){
      if(previous.name!==value.name||previous.startDate!==value.startDate||previous.endDate!==value.endDate)throw Object.assign(new ActionInputError('This rollover reference was already used for another session.'),{status:409});
      return {applied:true,alreadyApplied:true,sessionId:previous.id};
    }
    const current = sessions.filter(row => row.isCurrent);
    if (current.length > 1) throw new ActionInputError('More than one current session exists. Correct the current session before rollover.');
    if (sessions.some(row => row.name.toLowerCase() === value.name.toLowerCase() || (row.startDate <= value.endDate && row.endDate >= value.startDate))) throw new ActionInputError('The session name or date range overlaps an existing session.');
    if (current[0] && value.startDate <= current[0].endDate) throw new ActionInputError('The next session must start after the current session ends.');
    const roster = await tx.select({ id: students.id, name: students.name, loginId: students.loginRollNumber, roll: students.classRollNumber,
      classId: students.classId, className: classes.name, sectionId: students.sectionId, sectionName: sections.name, academicStatus: students.academicStatus,
      balance: sql<number>`COALESCE((SELECT sum(f.total_amount-f.paid_amount) FROM fee_invoices f WHERE f.student_id=${students.id} AND f.institution_id=${institutionId} AND f.status IN ('DUE','PARTIAL')),0)`.mapWith(Number),
    }).from(students).innerJoin(classes, eq(classes.id, students.classId)).innerJoin(sections, eq(sections.id, students.sectionId))
      .where(and(eq(students.institutionId, institutionId), isNull(students.deletedAt), eq(students.isActive, true))).orderBy(asc(students.id));
    const [balance] = await tx.select({ amount: sql<number>`COALESCE(sum(${feeInvoices.totalAmount}-${feeInvoices.paidAmount}),0)`.mapWith(Number) }).from(feeInvoices)
      .where(and(eq(feeInvoices.institutionId, institutionId), sql`${feeInvoices.status} IN ('DUE','PARTIAL')`));
    const classPlan = await tx.select({ classId: classes.id, className: classes.name, sectionId: sections.id, sectionName: sections.name }).from(classes)
      .leftJoin(sections, and(eq(sections.classId, classes.id), isNull(sections.deletedAt))).where(and(eq(classes.institutionId, institutionId), isNull(classes.deletedAt), eq(classes.isGraduatedArchive, false))).orderBy(asc(classes.id), asc(sections.id));
    const previewHash = createHash('sha256').update(JSON.stringify({ name: value.name, startDate: value.startDate, endDate: value.endDate, current: current.map(row => ({id:row.id,name:row.name,endDate:row.endDate})), roster, classPlan, balance })).digest('hex');
    const preview = { previewHash, current: current[0] ? {id:current[0].id,name:current[0].name,endDate:current[0].endDate} : null,
      students: roster.filter(row => row.academicStatus === 'ACTIVE').length, carryForwardBalance: balance.amount,
      classes: classPlan.map(row => ({ ...row, students: roster.filter(student => student.academicStatus === 'ACTIVE' && student.classId === row.classId && student.sectionId === row.sectionId).length })) };
    if (!apply) return { ...preview, applied: false };
    if (!value.confirm || !value.rolloverId || value.expectedPreviewHash !== previewHash) throw Object.assign(new ActionInputError('The preview changed or confirmation is missing. Review the rollover again.'), { status: 409 });
    if (current[0]) await tx.update(academicSessions).set({ isCurrent: false, record: { ...current[0].record, closedAt: new Date().toISOString(), closedBy: session.userId, closingRoster: roster } }).where(eq(academicSessions.id, current[0].id));
    const [created] = await tx.insert(academicSessions).values({ institutionId, name: value.name, startDate: value.startDate, endDate: value.endDate, isCurrent: true,
      record: { rolloverId: value.rolloverId, fromSessionId: current[0]?.id ?? null, openedBy: session.userId, openingBalance: balance.amount } }).returning({id:academicSessions.id});
    await tx.insert(auditLogs).values({ institutionId, actorId:session.userId, actorRole:session.role, action:'ACADEMIC_SESSION_ROLLOVER',target:`AcademicSession:${created.id}`,ip:'server' });
    return { ...preview, applied: true, sessionId: created.id };
  });
}

async function fetchInstitutionAcademicsData(institutionId: number) {
  const subjectQuery = db.select({ id: subjects.id, name: subjects.name, code: subjects.code }).from(subjects)
    .where(and(eq(subjects.institutionId, institutionId), isNull(subjects.deletedAt))).orderBy(asc(subjects.name));
  const classQuery = db.select({ id: classes.id, name: classes.name, level: classes.level,
    isFinalClass: sql<boolean>`${classes.isFinalClass}`.as('isFinalClass') }).from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isGraduatedArchive, false), isNull(classes.deletedAt)))
    .orderBy(asc(classes.level), asc(classes.name));
  const sectionQuery = db.select({ id: sections.id, name: sections.name,
    classId: sql<number>`${sections.classId}`.as('classId'),
    classTeacherId: sql<number | null>`${sections.classTeacherId}`.as('classTeacherId'),
    classTeacherName: sql<string | null>`${staff.name}`.as('classTeacherName') })
    .from(sections).leftJoin(staff, and(eq(staff.id, sections.classTeacherId), eq(staff.institutionId, institutionId)))
    .where(and(eq(sections.institutionId, institutionId), isNull(sections.deletedAt))).orderBy(asc(sections.name));
  const [data] = await db.select({
    subjects: jsonRows<Awaited<typeof subjectQuery>[number]>(subjectQuery),
    classes: jsonRows<Awaited<typeof classQuery>[number]>(classQuery),
    sections: jsonRows<Awaited<typeof sectionQuery>[number]>(sectionQuery),
  }).from(sql`(select 1) as anchor`);
  return data;
}
