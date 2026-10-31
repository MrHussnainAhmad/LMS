import { db } from "@/db";
import { announcements, expoPushTickets, staff, students, parentAccounts, parentStudents, pushDevices } from "@/db/schema";
import { resolveAnnouncementRecipients } from "@/lib/announcements";
import { and, eq, inArray, lt, or, ne, isNotNull, sql, SQL } from "drizzle-orm";
import { formatClassSection } from "@/lib/class-section-label";
import { createNotification, createBulkNotifications, createBulkNotificationsImmediately, type NotificationPayload } from './notification-delivery';
export { createNotification, createBulkNotifications, createBulkNotificationsImmediately };
type ExpoReceipt={status:'ok'|'error';message?:string;details?:{error?:string}};
const EXPO_RECEIPT_TIMEOUT_MS=20000;
function debugLog(message:string,meta?:Record<string,unknown>){if(process.env.DEBUG_NOTIFICATIONS==='1')console.info(message,meta);}
function chunkArray<T>(items:T[],size:number):T[][]{const result:T[][]=[];for(let i=0;i<items.length;i+=size)result.push(items.slice(i,i+size));return result;}
const ANNOUNCEMENT_RECIPIENT_CHUNK_SIZE=2000;
type AttendanceNotificationRecord={studentId:number;status:'PRESENT'|'ABSENT'|'LATE'|'LEAVE'};
export async function createAttendanceNotifications({institutionId,date,records}:{institutionId:number;date:Date|string;records:AttendanceNotificationRecord[]}) {
 const dateLabel=typeof date==='string'?date.split('T')[0]:date.toISOString().split('T')[0];
 if(!records.length)return;
 const links=await db.select({parentId:parentStudents.parentId,studentId:students.id,name:students.name}).from(parentStudents)
 .innerJoin(parentAccounts,and(eq(parentAccounts.id,parentStudents.parentId),eq(parentAccounts.institutionId,institutionId)))
 .innerJoin(students,and(eq(students.id,parentStudents.studentId),eq(students.institutionId,institutionId)))
 .where(and(eq(parentStudents.institutionId,institutionId),inArray(parentStudents.studentId,records.map(r=>r.studentId)),and(ne(parentAccounts.status,'DISABLED'),isNotNull(parentAccounts.passwordHash))));
 await createBulkNotifications(records.flatMap(record=>links.filter(l=>l.studentId===record.studentId).map(link=>({institutionId,userRole:'PARENT' as const,userId:link.parentId,studentId:link.studentId,
 type:'ATTENDANCE' as const,title:`Attendance: ${record.status.toLowerCase()}`,message:`${link.name} was marked ${record.status.toLowerCase()} on ${dateLabel}.`,eventKey:`attendance:${link.studentId}:${dateLabel}:${record.status}`}))));
}

export async function createDiaryNotifications({
  institutionId,
  classId,
  className,
  subjectName,
  date,
}: {
  institutionId: number;
  classId: number;
  className: string;
  subjectName?: string | null;
  date: string;
}) {
  const recipients = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.institutionId, institutionId), eq(students.classId, classId)));

  debugLog("Processing diary notification", {
    classId,
    studentRecipients: recipients.length,
  });

  const subjectLabel = subjectName ? ` for ${subjectName}` : "";

  return createBulkNotifications(recipients.map((student) => ({
    institutionId,
    userRole: "STUDENT",
    userId: student.id,
    type: "DIARY",
    title: "New Daily Diary",
    message: `A new daily diary entry has been added${subjectLabel} for ${className} on ${date}.`,
  })));
}

export async function createOnlineTestNotifications({
  institutionId,
  sectionId,
  onlineTestId,
  title,
  className,
  sectionName,
  subjectName,
  durationMinutes,
}: {
  institutionId: number;
  sectionId: number;
  onlineTestId: number;
  title: string;
  className: string;
  sectionName: string;
  subjectName: string;
  durationMinutes: number;
}, store: Pick<typeof db, 'select' | 'insert'> = db) {
  const recipients = await store
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.institutionId, institutionId), eq(students.sectionId, sectionId)));

  debugLog("Processing online test notification", {
    onlineTestId,
    sectionId,
    studentRecipients: recipients.length,
  });

  return createBulkNotifications(recipients.map((student) => ({
    institutionId,
    userRole: "STUDENT",
    userId: student.id,
    type: "TEST",
    title: "New Online Test",
    message: `${title} is available for ${formatClassSection(className, sectionName)} in ${subjectName}. Timer: ${durationMinutes} minutes.`,
    referenceId: onlineTestId,
  })), store);
}

/** Expo needs a few minutes before a receipt exists. */
const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;
/**
 * Expo stops serving receipts roughly a day after the push, so a ticket still
 * PENDING after this will never resolve and must be retired.
 */
const RECEIPT_ABANDON_MS = 24 * 60 * 60 * 1000;
/** Resolved tickets are kept this long for debugging, then pruned. */
const TICKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TICKET_PRUNE_BATCH_SIZE = 5_000;
const TICKET_PRUNE_MAX_BATCHES = 20;

export async function checkExpoPushReceipts() {
  const now = new Date();

  // Retire tickets Expo can no longer produce a receipt for.
  //
  // Bug fix, not just housekeeping: the query below takes 300 PENDING rows with no
  // ORDER BY, so tickets that never receive a receipt were re-selected forever. Once
  // 300 of them accumulate they can permanently crowd out newer tickets, silently
  // disabling both receipt processing and the DeviceNotRegistered token cleanup that
  // depends on it. Retiring them guarantees the backlog drains. Reuses the existing
  // FAILED status so nothing that reads this table sees an unfamiliar value.
  const abandoned = await db.update(expoPushTickets)
    .set({ status: 'FAILED', error: 'ReceiptExpired', checkedAt: now })
    .where(and(
      eq(expoPushTickets.status, 'PENDING'),
      lt(expoPushTickets.createdAt, new Date(now.getTime() - RECEIPT_ABANDON_MS)),
    ));
  const ticketsExpired = (abandoned as unknown as { rowCount?: number | null }).rowCount ?? 0;

  // Explicit column list: the previous `db.select()` fetched every column of every
  // row (including the unused notification_id/updated_at) 300 rows at a time, once a
  // minute, forever. Oldest first so the backlog drains in order.
  const pendingTickets = await db
    .select({
      id: expoPushTickets.id,
      ticketId: expoPushTickets.ticketId,
      token: expoPushTickets.token,
      userRole: expoPushTickets.userRole,
      userId: expoPushTickets.userId,
    })
    .from(expoPushTickets)
    .where(and(
      eq(expoPushTickets.status, 'PENDING'),
      lt(expoPushTickets.createdAt, new Date(now.getTime() - RECEIPT_CHECK_DELAY_MS)),
    ))
    .orderBy(expoPushTickets.createdAt)
    .limit(300);

  if (pendingTickets.length === 0) return { checked: 0, failed: 0, delivered: 0, ticketsExpired };

  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      ...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: pendingTickets.map(ticket => ticket.ticketId) }),
    // A stalled receipt check used to hang the whole worker interval indefinitely.
    signal: AbortSignal.timeout(EXPO_RECEIPT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Expo receipt check failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const receipts = (body.data || {}) as Record<string, ExpoReceipt>;

  const deliveredIds: number[] = [];
  const failedReasons = new Map<number, string>();
  const studentTokenClears: { id: number; token: string }[] = [];
  const staffTokenClears: { id: number; token: string }[] = [];

  for (const ticket of pendingTickets) {
    const receipt = receipts[ticket.ticketId];
    if (!receipt) continue;

    if (receipt.status === 'ok') {
      deliveredIds.push(ticket.id);
      continue;
    }

    const reason = receipt.details?.error || receipt.message || 'Unknown receipt error';
    failedReasons.set(ticket.id, reason);
    console.error("Expo Push Receipt Error:", { ticketRecordId: ticket.id, reason });

    if (receipt.details?.error === 'DeviceNotRegistered') {
      await db.update(pushDevices).set({revokedAt:now}).where(and(eq(pushDevices.token,ticket.token),eq(pushDevices.userId,ticket.userId),eq(pushDevices.userRole,ticket.userRole)));
      if (ticket.userRole === 'STUDENT') studentTokenClears.push({ id: ticket.userId, token: ticket.token });
      else if (ticket.userRole === 'STAFF') staffTokenClears.push({ id: ticket.userId, token: ticket.token });
    }
  }

  // Batch the ticket status updates instead of one round trip per ticket.
  if (deliveredIds.length > 0) {
    await db.update(expoPushTickets)
      .set({ status: 'DELIVERED', checkedAt: now })
      .where(inArray(expoPushTickets.id, deliveredIds));
  }

  if (failedReasons.size > 0) {
    const errorCase = errorReasonCase(failedReasons);
    await db.update(expoPushTickets)
      .set({ status: 'FAILED', error: errorCase, checkedAt: now })
      .where(inArray(expoPushTickets.id, Array.from(failedReasons.keys())));
  }

  // Batch token-clear updates per role instead of one Promise per unregistered device.
  await clearStaleExpoTokens(students, studentTokenClears);
  await clearStaleExpoTokens(staff, staffTokenClears);

  return {
    ticketsChecked: pendingTickets.length,
    tokensCleaned: studentTokenClears.length + staffTokenClears.length,
    errors: failedReasons.size,
    ticketsExpired,
  };
}

/**
 * Delete resolved push tickets past the retention window.
 *
 * expo_push_tickets is append-only in the current code — nothing ever deleted from
 * it — so it grows by one row per push delivered, forever, along with its three
 * indexes. That inflates disk, backups and the planner statistics behind the
 * PENDING lookup above. Only DELIVERED/FAILED rows are eligible, so an in-flight
 * ticket is never removed, and the statuses are matched explicitly (rather than
 * `status <> 'PENDING'`) so the delete rides the existing
 * expo_push_tickets_status_created_at_idx as two range scans.
 *
 * Batched for the same reason as the refresh-token prune: the first run on a table
 * that has never been pruned could otherwise delete millions of rows in one
 * transaction, holding locks and generating WAL while requests wait on the same
 * PgBouncer pool.
 */
export async function pruneResolvedPushTickets(): Promise<{ deleted: number; backlogRemaining: boolean }> {
  const cutoff = new Date(Date.now() - TICKET_RETENTION_MS);
  let deleted = 0;

  for (let batch = 0; batch < TICKET_PRUNE_MAX_BATCHES; batch += 1) {
    const result = await db.execute(sql`
      DELETE FROM ${expoPushTickets}
      WHERE id IN (
        SELECT id FROM ${expoPushTickets}
        WHERE ${expoPushTickets.status} IN ('DELIVERED', 'FAILED')
          AND ${expoPushTickets.createdAt} < ${cutoff}
        LIMIT ${TICKET_PRUNE_BATCH_SIZE}
      )
    `);

    const affected = (result as unknown as { rowCount?: number | null }).rowCount ?? 0;
    deleted += affected;
    if (affected < TICKET_PRUNE_BATCH_SIZE) return { deleted, backlogRemaining: false };
  }

  return { deleted, backlogRemaining: true };
}

function errorReasonCase(reasons: Map<number, string>): SQL {
  const chunks: SQL[] = [sql`CASE ${expoPushTickets.id}`];
  for (const [id, reason] of reasons) chunks.push(sql`WHEN ${id} THEN ${reason}`);
  chunks.push(sql`ELSE ${expoPushTickets.error} END`);
  return sql.join(chunks, sql` `);
}

async function clearStaleExpoTokens(table: typeof students | typeof staff, entries: { id: number; token: string }[]) {
  if (entries.length === 0) return;
  const condition = or(...entries.map(({ id, token }) => and(eq(table.id, id), eq(table.expoPushToken, token))));
  if (!condition) return;
  await db.update(table).set({ expoPushToken: null }).where(condition);
}

export async function processAnnouncementNotification(announcementId: number) {
  const [announcement] = await db.select().from(announcements).where(eq(announcements.id, announcementId));
  if (!announcement) {
    console.warn("Announcement notification skipped: announcement not found", { announcementId });
    return;
  }

  // Read by primary key, then every notification produced below is stamped with
  // *this row's* institutionId — so a fan-out can never cross tenants even though
  // the read itself has no institution predicate (callers pass ids they created
  // inside their own tenant). Hoisted out of the payload builder so the invariant is
  // visible next to the query, and close enough to it for
  // scripts/audit-tenant-scope.mjs to see.
  const institutionId = announcement.institutionId;
  const { invalidateAnnouncementReadCaches } = await import('@/lib/redis');
  await invalidateAnnouncementReadCaches(institutionId);

  debugLog("Processing announcement notification", {
    announcementId: announcement.id,
    targetType: announcement.targetType,
    targetCampusId: announcement.targetCampusId,
    targetClassId: announcement.targetClassId,
    targetSectionId: announcement.targetSectionId,
    targetUserRole: announcement.targetUserRole,
    targetUserId: announcement.targetUserId,
    senderRole: announcement.senderRole,
    senderId: announcement.senderId,
  });

  const type = /\bexam (scheduled|updated|cancelled):|exam timetable/i.test(announcement.title) ? 'EXAM_TIMETABLE' : announcement.title.toLowerCase().includes('timetable') ? 'TIMETABLE' : 'ANNOUNCEMENT';
  const message = announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : '');

  const recipients = await resolveAnnouncementRecipients(announcement);
  const toPayload = (recipient: { userRole: NotificationPayload["userRole"]; userId: number }): NotificationPayload => ({
    institutionId,
    userRole: recipient.userRole,
    userId: recipient.userId,
    type,
    title: announcement.title,
    message,
    referenceId: announcement.id,
  });

  let notificationsCreated = 0;
  if (recipients.length > ANNOUNCEMENT_RECIPIENT_CHUNK_SIZE) {
    for (const recipientChunk of chunkArray(recipients, ANNOUNCEMENT_RECIPIENT_CHUNK_SIZE)) {
      const inserted = await createBulkNotifications(recipientChunk.map(toPayload));
      notificationsCreated += inserted?.length ?? 0;
    }
  } else {
    const inserted = await createBulkNotifications(recipients.map(toPayload));
    notificationsCreated = inserted?.length ?? 0;
  }

  debugLog("Announcement notification fan-out", {
    announcementId: announcement.id,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    senderId: announcement.senderId,
    recipients: recipients.length,
    notificationsCreated,
  });
}
