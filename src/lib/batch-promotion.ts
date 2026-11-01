import { and, eq, inArray, isNull, sql, SQL } from "drizzle-orm";
import { db } from "@/db";
import { batchExams, classes, sections, studentPromotions, students } from "@/db/schema";
import { getBatchExamReport } from './batch-exams';
import { ActionInputError } from './action-input-error';
import { invalidateStudentEnrichCache, invalidateInstitutionRosterCaches } from "@/lib/redis";

const numericRoll = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
const classRank = (classRow: { level: number; name: string }) => {
  if (classRow.level !== 0) return classRow.level;
  const numericName = classRow.name.match(/\d+/)?.[0];
  return numericName ? Number(numericName) : 0;
};

/** Builds a single `CASE students.id WHEN ... THEN ... END` expression so N per-row roll-number
 * updates can be applied as one bulk UPDATE instead of N sequential round trips. */
function rollNumberCase(assignments: Map<number, string>): SQL {
  const chunks: SQL[] = [sql`CASE ${students.id}`];
  for (const [id, roll] of assignments) chunks.push(sql`WHEN ${id} THEN ${roll}`);
  chunks.push(sql`ELSE ${students.classRollNumber} END`);
  return sql.join(chunks, sql` `);
}

/** Applies one explicitly approved, published promotion roster in a single transaction. */
export async function applyPublishedBatchPromotion(institutionId: number, batchExamId: number, expectedVersion: number) {
  const outcome = await db.transaction(async tx => {
  // Promotions share destination roll numbers and the graduation archive.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(80427, ${institutionId})`);
  const [exam] = await tx.select().from(batchExams).where(and(eq(batchExams.id, batchExamId), eq(batchExams.institutionId, institutionId))).for('update').limit(1);
  if (!exam || exam.type !== "PROMOTION") return { promoted: false as const, reason: "not_promotion" };
  if (exam.settings.promotionAppliedAt) return { promoted: false as const, reason: "already_processed" };
  if (!exam.officialPublishedAt) return { promoted: false as const, reason: "publish_results_first" };
  if ((exam.settings.reportVersion ?? 1) !== expectedVersion) return { promoted: false as const, reason: "report_changed_review_again" };
  const report = await getBatchExamReport(institutionId, exam.id, tx);
  if (!report.ready || report.students.some(student => student.result === 'PENDING')) return { promoted: false as const, reason: "incomplete_results" };
  const rosterIds = report.students.map(student => student.id);
  const sourceStudents = await tx.select().from(students).where(and(
    eq(students.institutionId, institutionId), eq(students.classId, exam.classId),
    eq(students.isActive, true), eq(students.academicStatus, 'ACTIVE'), sql`${students.deletedAt} IS NULL`,
    inArray(students.id, rosterIds),
  )).for('update');
  if (!sourceStudents.length || sourceStudents.length !== rosterIds.length) return { promoted: false as const, reason: "roster_changed_review_required" };
  const allClasses = await tx.select().from(classes).where(eq(classes.institutionId, exam.institutionId));
  const sourceClass = allClasses.find((classRow) => classRow.id === exam.classId);
  if (!sourceClass) throw new Error("Promotion class not found");
  const sourceRank = classRank(sourceClass);
  const graduating = sourceClass.isFinalClass;
  const targetClass = graduating ? null : allClasses.find((classRow) => !classRow.isGraduatedArchive && classRank(classRow) === sourceRank + 1 && !/\s\(old\)$/i.test(classRow.name));
  if (!graduating && !targetClass) return { promoted: false as const, reason: "missing_next_class" };
  const passedIds = new Set(report.students.filter(student => student.result === 'PASS').map(student => student.id));
  const passing = sourceStudents.filter(student => passedIds.has(student.id));
  const retained = sourceStudents.filter((student) => !passing.some((passed) => passed.id === student.id));
  const originalRolls = new Map(sourceStudents.map((student) => [student.id, student.classRollNumber]));
  const assignedRolls = new Map<number, string>();
    const retainedIds = retained.map((student) => student.id);
    const passingIds = passing.map((student) => student.id);

    // Free up existing roll numbers with unique temp placeholders before reassigning, in bulk.
    if (retainedIds.length) {
      await tx.update(students).set({ classRollNumber: sql`('__retained_' || ${students.id}::text)` }).where(inArray(students.id, retainedIds));
    }
    if (passingIds.length) {
      await tx.update(students).set({ classRollNumber: sql`('__promoted_' || ${students.id}::text)` }).where(inArray(students.id, passingIds));
    }

    if (targetClass) {
      const destinationSections = await tx.select().from(sections).where(and(eq(sections.institutionId, exam.institutionId), eq(sections.classId, targetClass.id), isNull(sections.deletedAt)));
      if (!destinationSections.length) throw new ActionInputError("Destination class must have an active section before promotion");
      const sourceSections = await tx.select().from(sections).where(and(
        eq(sections.classId, exam.classId),
        eq(sections.institutionId, exam.institutionId),
      ));
      const destinationsByName = new Map(destinationSections.map((section) => [section.name.toLowerCase(), section])); const sourceById = new Map(sourceSections.map((section) => [section.id, section]));

      // Group students by destination section so the classId/sectionId/status move is a handful
      // of bulk updates instead of one round trip per student.
      const idsByDestination = new Map<number, number[]>();
      for (const student of passing) {
        const source = sourceById.get(student.sectionId);
        const destination = source ? destinationsByName.get(source.name.toLowerCase()) || destinationSections[0] : destinationSections[0];
        const ids = idsByDestination.get(destination.id) || [];
        ids.push(student.id);
        idsByDestination.set(destination.id, ids);
      }
      for (const [destinationId, ids] of idsByDestination) {
        await tx.update(students).set({ classId: targetClass.id, sectionId: destinationId, academicStatus: "ACTIVE" }).where(inArray(students.id, ids));
      }

      const destinationRows = await tx.select({ roll: students.classRollNumber }).from(students).where(and(eq(students.institutionId, exam.institutionId), eq(students.classId, targetClass.id)));
      let nextRoll = Math.max(0, ...destinationRows.filter((row) => !row.roll.startsWith("__promoted_")).map((row) => numericRoll(row.roll))) + 1;
      for (const student of passing.sort((a, b) => a.id - b.id)) {
        assignedRolls.set(student.id, String(nextRoll++));
      }
      if (passingIds.length) {
        await tx.update(students).set({ classRollNumber: rollNumberCase(assignedRolls) }).where(inArray(students.id, passingIds));
      }
    } else {
      let [archiveClass] = await tx.select().from(classes).where(and(eq(classes.institutionId, exam.institutionId), eq(classes.isGraduatedArchive, true))).limit(1);
      if (!archiveClass) {
        [archiveClass] = await tx.insert(classes).values({
          institutionId: exam.institutionId,
          name: "Graduated",
          level: 9999,
          isFinalClass: false,
          isGraduatedArchive: true,
        }).returning();
      }
      let [archiveSection] = await tx.select().from(sections).where(and(eq(sections.institutionId, exam.institutionId), eq(sections.classId, archiveClass.id))).limit(1);
      if (!archiveSection) {
        [archiveSection] = await tx.insert(sections).values({
          institutionId: exam.institutionId,
          classId: archiveClass.id,
          name: "Graduated",
          classTeacherId: null,
        }).returning();
      }
      const archiveRows = await tx.select({ roll: students.classRollNumber }).from(students).where(and(eq(students.institutionId, exam.institutionId), eq(students.classId, archiveClass.id)));
      let nextGraduateRoll = Math.max(0, ...archiveRows.map((row) => {
        const match = row.roll.match(/^GRAD-(\d+)$/i);
        return match ? Number(match[1]) : numericRoll(row.roll);
      })) + 1;
      for (const student of passing.sort((a, b) => a.id - b.id)) {
        assignedRolls.set(student.id, `GRAD-${String(nextGraduateRoll++).padStart(5, "0")}`);
      }
      if (passingIds.length) {
        await tx.update(students).set({
          academicStatus: "GRADUATED",
          classId: archiveClass.id,
          sectionId: archiveSection.id,
          classRollNumber: rollNumberCase(assignedRolls),
        }).where(inArray(students.id, passingIds));
      }
    }

    const currentRows = await tx.select({ roll: students.classRollNumber }).from(students).where(and(eq(students.institutionId, exam.institutionId), eq(students.classId, exam.classId)));
    let nextRetained = Math.max(0, ...currentRows.filter((row) => !row.roll.startsWith("__retained_")).map((row) => numericRoll(row.roll))) + 1;
    const retainedRolls = new Map<number, string>();
    for (const student of retained.sort((a, b) => a.id - b.id)) {
      const classRollNumber = String(nextRetained++);
      assignedRolls.set(student.id, classRollNumber);
      retainedRolls.set(student.id, classRollNumber);
    }
    if (retainedIds.length) {
      await tx.update(students).set({ classRollNumber: rollNumberCase(retainedRolls) }).where(inArray(students.id, retainedIds));
    }

    await tx.insert(studentPromotions).values([...passing.map((student) => ({ institutionId: exam.institutionId, studentId: student.id, fromClassId: exam.classId, toClassId: targetClass?.id || null, status: targetClass ? "PROMOTED" as const : "GRADUATED" as const, fromRollNumber: originalRolls.get(student.id), toRollNumber: assignedRolls.get(student.id) || null })), ...retained.map((student) => ({ institutionId: exam.institutionId, studentId: student.id, fromClassId: exam.classId, toClassId: exam.classId, status: "RETAINED" as const, fromRollNumber: originalRolls.get(student.id), toRollNumber: assignedRolls.get(student.id) || null }))]);
    await tx.update(batchExams).set({ settings: { ...exam.settings, promotionAppliedAt: new Date().toISOString() } }).where(eq(batchExams.id, exam.id));
    return { promoted: true as const, promotedCount: passing.length, retainedCount: retained.length, graduatedCount: targetClass ? 0 : passing.length, studentIds: sourceStudents.map(student => student.id) };
  });

  if (outcome.promoted) {
    await invalidateStudentEnrichCache(institutionId, outcome.studentIds);
    await invalidateInstitutionRosterCaches(institutionId);
  }
  return outcome;
}
