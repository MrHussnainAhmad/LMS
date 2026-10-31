import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { institutions, sections, classes } from '@/db/schema';
import { ActionInputError } from './action-input-error';

/** Reuse an active section, including when called inside a student import transaction. */
export async function getOrCreateWholeClassSection(institutionId: number, classId: number, client: Pick<typeof db, 'select' | 'insert'> = db) {
  const [classRow] = await client.select({ id: classes.id }).from(classes)
    .where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId), isNull(classes.deletedAt))).limit(1);
  if (!classRow) throw new ActionInputError('Class not found');
  const [existing] = await client.select({ id: sections.id, classId: sections.classId, name: sections.name })
    .from(sections).where(and(
      eq(sections.institutionId, institutionId), eq(sections.classId, classId),
      eq(sections.name, 'Whole Class'), isNull(sections.deletedAt),
    )).limit(1);
  if (existing) return existing;
  const [created] = await client.insert(sections).values({
    institutionId, classId, name: 'Whole Class', classTeacherId: null,
  }).returning({ id: sections.id, classId: sections.classId, name: sections.name });
  return created;
}

/** Resolve the public parent namespace once per create/import/enrollment operation. */
export async function resolveStudentLoginInstitution<T extends {
  type: string; username: string; parentInstitutionId: number | null; campusName: string | null;
}>(institution: T) {
  if (institution.parentInstitutionId === null) return { ...institution, parentUsername: null };
  const [parent] = await db.select({ username: institutions.username }).from(institutions)
    .where(and(eq(institutions.id, institution.parentInstitutionId), isNull(institutions.parentInstitutionId), isNull(institutions.deletedAt))).limit(1);
  if (!parent) throw new Error('Parent institution not found for campus student login.');
  return { ...institution, parentUsername: parent.username };
}
