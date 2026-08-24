import { db } from "@/db";
import {
  announcements,
  feeVoucherCycles,
  institutions,
  students,
} from "@/db/schema";
import { createBulkNotificationsImmediately } from "@/lib/notifications";
import { and, eq, inArray, isNull } from "drizzle-orm";

const KARACHI_TIME_ZONE = "Asia/Karachi";

/**
 * Rows per INSERT statement. 1 000 rows × 9 columns is ~9 000 bind parameters,
 * comfortably under Postgres' 65 535 limit, and issues 5× fewer round trips than
 * the previous 200 on the once-a-month passes that do insert a full roster.
 */
const INSERT_CHUNK_SIZE = 1_000;

/** Bind-parameter budget for the automation-key existence probe below. */
const KEY_LOOKUP_CHUNK_SIZE = 2_000;

type MonthState = {
  year: number;
  month: number;
  day: number;
  billingMonth: string;
  monthLabel: string;
};

function chunkArray<T>(items: T[], size = INSERT_CHUNK_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function ordinal(day: number) {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function getFeeVoucherMonthState(now = new Date()): MonthState {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en-PK", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return { year, month, day, billingMonth, monthLabel };
}

export function getFeeVoucherScheduleState({
  now = new Date(),
  openDay,
  lateDay,
}: {
  now?: Date;
  openDay: number;
  lateDay: number;
}) {
  const month = getFeeVoucherMonthState(now);
  return {
    ...month,
    isOpen: month.day >= openDay,
    isLate: month.day >= lateDay,
  };
}

export async function processFeeVoucherSchedules(now = new Date()) {
  const month = getFeeVoucherMonthState(now);
  const configuredInstitutions = await db
    .select({
      id: institutions.id,
      openDay: institutions.feeVoucherOpenDay,
      lateDay: institutions.feeVoucherLateDay,
      lateFee: institutions.feeVoucherLateFee,
    })
    .from(institutions)
    .where(eq(institutions.acceptFeeVouchers, true));

  const summary = {
    institutionsChecked: configuredInstitutions.length,
    cyclesCreated: 0,
    studentsMarkedLate: 0,
    announcementsCreated: 0,
  };

  for (const institution of configuredInstitutions) {
    if (
      !institution.openDay
      || !institution.lateDay
      || month.day < institution.openDay
    ) {
      continue;
    }

    // Only the active students that do not yet have a cycle for this billing
    // month, resolved in one indexed anti-join.
    //
    // Previously this pulled the entire active roster into memory and re-offered
    // every student to `INSERT ... ON CONFLICT DO NOTHING` — every hour, for the
    // rest of the month. For 50 institutions × 2 000 students that is ~100 000
    // no-op insert rows an hour, each one a unique-index probe plus WAL, on the
    // same PgBouncer pool that serves live requests. Steady state is now a single
    // query that returns zero rows.
    //
    // The anti-join uses fee_voucher_cycles_institution_student_month_unique
    // (institution_id, student_id, billing_month) as a nested-loop probe, and the
    // semantics are identical: a student whose cycle row was deleted reappears
    // here and is recreated, so the self-healing design is preserved.
    const studentsMissingCycle = await db
      .select({ id: students.id })
      .from(students)
      .leftJoin(feeVoucherCycles, and(
        eq(feeVoucherCycles.institutionId, institution.id),
        eq(feeVoucherCycles.studentId, students.id),
        eq(feeVoucherCycles.billingMonth, month.billingMonth),
      ))
      .where(and(
        eq(students.institutionId, institution.id),
        eq(students.isActive, true),
        eq(students.academicStatus, "ACTIVE"),
        isNull(students.deletedAt),
        isNull(feeVoucherCycles.id),
      ));

    for (const studentChunk of chunkArray(studentsMissingCycle)) {
      const insertedCycles = await db
        .insert(feeVoucherCycles)
        .values(studentChunk.map((student) => ({
          institutionId: institution.id,
          studentId: student.id,
          billingMonth: month.billingMonth,
        })))
        .onConflictDoNothing()
        .returning({ id: feeVoucherCycles.id });
      summary.cyclesCreated += insertedCycles.length;
    }

    // Do not send an opening and late notice together if processing first
    // resumes after the late day.
    if (month.day < institution.lateDay) {
      const [openingAnnouncement] = await db
        .insert(announcements)
        .values({
          institutionId: institution.id,
          senderRole: "INSTITUTION",
          senderId: institution.id,
          targetType: "USER",
          targetUserRole: "STUDENT",
          targetUserId: null,
          automationKey: `fee-voucher:open:${institution.id}:${month.billingMonth}`,
          title: `${month.monthLabel} fee voucher uploads are open`,
          content: institution.lateFee > 0
            ? `Upload your ${month.monthLabel} fee voucher by the ${ordinal(institution.lateDay - 1)}. From the ${ordinal(institution.lateDay)}, a late fee of PKR ${institution.lateFee.toLocaleString("en-PK")} applies.`
            : `Upload your ${month.monthLabel} fee voucher by the ${ordinal(institution.lateDay - 1)}. Late submissions begin on the ${ordinal(institution.lateDay)}.`,
        })
        .onConflictDoNothing({ target: announcements.automationKey })
        .returning({
          id: announcements.id,
          title: announcements.title,
          content: announcements.content,
        });

      if (openingAnnouncement) {
        summary.announcementsCreated += 1;
        // The full roster is only needed here, and this branch runs at most once
        // per institution per month: the insert above is guarded by a unique
        // automation key, so `openingAnnouncement` is undefined on every
        // subsequent hourly pass. Fetching it lazily keeps the roster SELECT out
        // of the steady-state path entirely.
        const activeStudents = await db
          .select({ id: students.id })
          .from(students)
          .where(and(
            eq(students.institutionId, institution.id),
            eq(students.isActive, true),
            eq(students.academicStatus, "ACTIVE"),
            isNull(students.deletedAt),
          ));

        for (const studentChunk of chunkArray(activeStudents)) {
          await createBulkNotificationsImmediately(studentChunk.map((student) => ({
            institutionId: institution.id,
            userRole: "STUDENT" as const,
            userId: student.id,
            type: "ANNOUNCEMENT" as const,
            title: openingAnnouncement.title,
            message: openingAnnouncement.content,
            referenceId: openingAnnouncement.id,
          })));
        }
      }
    }

    if (month.day < institution.lateDay) continue;

    const newlyLate = await db
      .update(feeVoucherCycles)
      .set({
        status: "LATE",
        lateFeeAmount: institution.lateFee,
        lateMarkedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(feeVoucherCycles.institutionId, institution.id),
        eq(feeVoucherCycles.billingMonth, month.billingMonth),
        eq(feeVoucherCycles.status, "DUE"),
      ))
      .returning({ studentId: feeVoucherCycles.studentId });

    summary.studentsMarkedLate += newlyLate.length;

    // Query all late rows, not only this run's updates. If a worker stopped
    // between marking a cycle late and creating its announcement, the next
    // hourly pass repairs the missing announcement without duplicating it.
    const lateCycles = await db
      .select({ studentId: feeVoucherCycles.studentId })
      .from(feeVoucherCycles)
      .where(and(
        eq(feeVoucherCycles.institutionId, institution.id),
        eq(feeVoucherCycles.billingMonth, month.billingMonth),
        eq(feeVoucherCycles.status, "LATE"),
      ));

    const lateAnnouncementKey = (studentId: number) =>
      `fee-voucher:late:${institution.id}:${studentId}:${month.billingMonth}`;

    // Which of those already have their announcement. The repair pass used to
    // re-offer every late cycle to `ON CONFLICT DO NOTHING` on every hourly run
    // for the rest of the month; reading the existing automation keys instead
    // turns the steady state into zero insert statements, zero WAL and zero dead
    // tuples. Self-healing is unchanged — a deleted announcement row is simply
    // absent from this set, so it is recreated on the next pass.
    //
    // Chunked because a whole institution can be late at once, and probed through
    // the unique index on announcements.automation_key.
    const existingAnnouncementKeys = new Set<string>();
    for (const keyChunk of chunkArray(lateCycles.map((cycle) => lateAnnouncementKey(cycle.studentId)), KEY_LOOKUP_CHUNK_SIZE)) {
      const rows = await db
        .select({ automationKey: announcements.automationKey })
        .from(announcements)
        .where(and(
          eq(announcements.institutionId, institution.id),
          inArray(announcements.automationKey, keyChunk),
        ));
      for (const row of rows) {
        if (row.automationKey) existingAnnouncementKeys.add(row.automationKey);
      }
    }

    const cyclesNeedingAnnouncement = lateCycles.filter(
      (cycle) => !existingAnnouncementKeys.has(lateAnnouncementKey(cycle.studentId)),
    );

    for (const studentChunk of chunkArray(cyclesNeedingAnnouncement)) {
      const insertedAnnouncements = await db
        .insert(announcements)
        .values(studentChunk.map((student) => ({
          institutionId: institution.id,
          senderRole: "INSTITUTION" as const,
          senderId: institution.id,
          targetType: "USER" as const,
          targetUserRole: "STUDENT" as const,
          targetUserId: student.studentId,
          automationKey: `fee-voucher:late:${institution.id}:${student.studentId}:${month.billingMonth}`,
          title: `${month.monthLabel} fee voucher is overdue`,
          content: institution.lateFee > 0
            ? `Your ${month.monthLabel} fee voucher has not been uploaded. A late fee of PKR ${institution.lateFee.toLocaleString("en-PK")} now applies. Please upload the voucher as soon as possible.`
            : `Your ${month.monthLabel} fee voucher has not been uploaded. Please upload it as soon as possible.`,
        })))
        .onConflictDoNothing({ target: announcements.automationKey })
        .returning({
          id: announcements.id,
          targetUserId: announcements.targetUserId,
          title: announcements.title,
          content: announcements.content,
        });

      summary.announcementsCreated += insertedAnnouncements.length;
      await createBulkNotificationsImmediately(insertedAnnouncements.flatMap((announcement) =>
        announcement.targetUserId
          ? [{
              institutionId: institution.id,
              userRole: "STUDENT" as const,
              userId: announcement.targetUserId,
              type: "ANNOUNCEMENT" as const,
              title: announcement.title,
              message: announcement.content,
              referenceId: announcement.id,
            }]
          : []
      ));
    }
  }

  return summary;
}
