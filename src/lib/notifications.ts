import { db } from "@/db";
import { expoPushTickets, notifications, staff, students } from "@/db/schema";
import { resolveAnnouncementRecipients } from "@/lib/announcements";
import { and, eq, inArray, lt, or, sql, SQL } from "drizzle-orm";
import { after } from "next/server";

type NotificationType = 'ANNOUNCEMENT' | 'EXAM_TIMETABLE' | 'ASSIGNMENT' | 'TEST' | 'MARKS' | 'ATTENDANCE' | 'GENERAL' | 'LEAVE_REQUEST' | 'DIARY';

type NotificationPayload = {
  institutionId: number;
  userRole: 'STUDENT' | 'STAFF' | 'INSTITUTION' | 'EMPLOYEE' | 'SUPER_ADMIN';
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: number;
};

type AttendanceNotificationRecord = {
  studentId: number;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
};

type NotificationDelivery = NotificationPayload & {
  notificationId?: number;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

type PushDeliverySummary = {
  payloads: number;
  targets: number;
  missingTokens: number;
  disabledByPreference: number;
  tickets: number;
  ticketErrors: number;
};

const NOTIFICATION_INSERT_CHUNK_SIZE = 200;
const ANNOUNCEMENT_RECIPIENT_CHUNK_SIZE = 2000;
/** Cap parallel post-response push jobs so after() storms can't pin CPU/RAM. */
const MAX_CONCURRENT_PUSH_JOBS = 2;

let activePushJobs = 0;
const pendingPushJobs: Array<() => void> = [];

function acquirePushSlot(): Promise<void> {
  if (activePushJobs < MAX_CONCURRENT_PUSH_JOBS) {
    activePushJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pendingPushJobs.push(() => {
      activePushJobs += 1;
      resolve();
    });
  });
}

function releasePushSlot() {
  activePushJobs = Math.max(0, activePushJobs - 1);
  const next = pendingPushJobs.shift();
  if (next) next();
}

function debugLog(message: string, meta?: Record<string, unknown>) {
  if (process.env.DEBUG_NOTIFICATIONS === "1") {
    console.info(message, meta);
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function createNotification(payload: NotificationPayload) {
  debugLog("Creating single notification", {
    type: payload.type,
    userRole: payload.userRole,
    userId: payload.userId,
    referenceId: payload.referenceId,
  });

  const [inserted] = await db.insert(notifications).values(payload).returning({ id: notifications.id });
  scheduleExpoPushNotifications([{ ...payload, notificationId: inserted?.id }]);
  return inserted;
}

export async function createBulkNotifications(payloads: NotificationPayload[]) {
  debugLog("Creating bulk notifications", {
    payloads: payloads.length,
    types: Array.from(new Set(payloads.map((payload) => payload.type))),
    studentRecipients: payloads.filter((payload) => payload.userRole === "STUDENT").length,
    staffRecipients: payloads.filter((payload) => payload.userRole === "STAFF").length,
  });

  if (payloads.length === 0) return;

  const insertedRows: { id: number }[] = [];
  for (const chunk of chunkArray(payloads, NOTIFICATION_INSERT_CHUNK_SIZE)) {
    const chunkRows = await db.insert(notifications).values(chunk).returning({ id: notifications.id });
    insertedRows.push(...chunkRows);
  }
  debugLog("Bulk notification rows inserted", {
    requested: payloads.length,
    inserted: insertedRows.length,
  });

  const deliveries = payloads.map((payload, index) => ({
    ...payload,
    notificationId: insertedRows[index]?.id,
  }));
  scheduleExpoPushNotifications(deliveries);
  return insertedRows;
}

/**
 * Background-worker variant. Unlike createBulkNotifications(), this does not
 * depend on Next.js request-scoped after() and waits for push delivery setup.
 */
export async function createBulkNotificationsImmediately(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return [];

  const insertedRows: { id: number }[] = [];
  for (const chunk of chunkArray(payloads, NOTIFICATION_INSERT_CHUNK_SIZE)) {
    const chunkRows = await db.insert(notifications).values(chunk).returning({ id: notifications.id });
    insertedRows.push(...chunkRows);
  }

  await sendExpoPushNotifications(payloads.map((payload, index) => ({
    ...payload,
    notificationId: insertedRows[index]?.id,
  })));

  return insertedRows;
}

function scheduleExpoPushNotifications(deliveries: NotificationDelivery[]) {
  after(async () => {
    await acquirePushSlot();
    try {
      await sendExpoPushNotifications(deliveries);
    } catch (error) {
      console.error("Expo push delivery failed:", error);
    } finally {
      releasePushSlot();
    }
  });
}

export async function createAttendanceNotifications({
  institutionId,
  date,
  records,
}: {
  institutionId: number;
  date: Date | string;
  records: AttendanceNotificationRecord[];
}) {
  const dateLabel = date instanceof Date ? date.toISOString().split("T")[0] : date.split("T")[0];
  const notifyList = records.filter((record) => (
    record.status === "ABSENT" || record.status === "LEAVE" || record.status === "LATE"
  ));
  const studentIds = Array.from(new Set(notifyList.map((record) => record.studentId)));
  const studentRows = studentIds.length > 0
    ? await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(and(eq(students.institutionId, institutionId), inArray(students.id, studentIds)))
    : [];
  const studentNames = new Map(studentRows.map((student) => [student.id, student.name]));

  await createBulkNotifications(notifyList.map((record) => {
    const studentName = studentNames.get(record.studentId) || "Student";
    const isAbsent = record.status === "ABSENT";

    return {
      institutionId,
      userRole: "STUDENT",
      userId: record.studentId,
      type: "ATTENDANCE",
      title: isAbsent ? `${studentName} was absent from school.` : "Attendance Alert",
      message: isAbsent
        ? `Dear Parents/Guardians, please be informed that ${studentName} was absent on ${dateLabel}.`
        : `You have been marked ${record.status} for ${dateLabel}.`,
    };
  }));
}

async function sendExpoPushNotifications(payloads: NotificationDelivery[]): Promise<PushDeliverySummary> {
  const summary: PushDeliverySummary = {
    payloads: payloads.length,
    targets: 0,
    missingTokens: 0,
    disabledByPreference: 0,
    tickets: 0,
    ticketErrors: 0,
  };

  try {
    const studentIds = Array.from(new Set(payloads.filter(p => p.userRole === 'STUDENT').map(p => p.userId)));
    const staffIds = Array.from(new Set(payloads.filter(p => p.userRole === 'STAFF').map(p => p.userId)));

    const studentPushState = new Map<number, {
      token: string | null;
      testNotifications: boolean;
      announcementNotifications: boolean;
    }>();
    const staffPushState = new Map<number, {
      token: string | null;
      announcementNotifications: boolean;
    }>();

    if (studentIds.length > 0) {
      const studentRecords = await db
        .select({
          id: students.id,
          token: students.expoPushToken,
          testNotifications: students.testPushNotificationsEnabled,
          announcementNotifications: students.announcementPushNotificationsEnabled,
        })
        .from(students)
        .where(inArray(students.id, studentIds));

      studentRecords.forEach((record) => {
        studentPushState.set(record.id, {
          token: record.token,
          testNotifications: record.testNotifications,
          announcementNotifications: record.announcementNotifications,
        });
      });
    }

    if (staffIds.length > 0) {
      const staffRecords = await db
        .select({
          id: staff.id,
          token: staff.expoPushToken,
          announcementNotifications: staff.announcementPushNotificationsEnabled,
        })
        .from(staff)
        .where(inArray(staff.id, staffIds));

      staffRecords.forEach((record) => {
        staffPushState.set(record.id, {
          token: record.token,
          announcementNotifications: record.announcementNotifications,
        });
      });
    }

    debugLog("Expo push token lookup", {
      studentRecipients: studentIds.length,
      studentTokens: Array.from(studentPushState.values()).filter((state) => Boolean(state.token)).length,
      staffRecipients: staffIds.length,
      staffTokens: Array.from(staffPushState.values()).filter((state) => Boolean(state.token)).length,
    });

    const targets = payloads.flatMap((payload) => {
      const studentState = payload.userRole === 'STUDENT' ? studentPushState.get(payload.userId) : undefined;
      const staffState = payload.userRole === 'STAFF' ? staffPushState.get(payload.userId) : undefined;
      const token = studentState?.token ?? staffState?.token;

      if (!token) {
        summary.missingTokens++;
        return [];
      }

      const announcementLike = payload.type === 'ANNOUNCEMENT' || payload.type === 'EXAM_TIMETABLE';
      const enabled = payload.userRole === 'STUDENT'
        ? payload.type === 'TEST'
          ? studentState?.testNotifications
          : announcementLike
            ? studentState?.announcementNotifications
            : true
        : payload.userRole === 'STAFF'
          ? announcementLike
            ? staffState?.announcementNotifications
            : true
          : false;

      if (!enabled) {
        summary.disabledByPreference++;
        return [];
      }

      return [{
        token,
        payload,
        message: {
          to: token,
          sound: 'default',
          title: payload.title,
          body: payload.message,
          data: { type: payload.type, referenceId: payload.referenceId },
        },
      }];
    });

    summary.targets = targets.length;

    if (targets.length === 0) {
      debugLog("Expo push delivery summary", summary);
      return summary;
    }

    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) chunks.push(targets.slice(i, i + CHUNK_SIZE));

    for (const chunk of chunks) {
      let tickets: ExpoTicket[];
      try {
        tickets = await sendExpoChunkWithRetry(chunk.map(item => item.message));
      } catch (error) {
        chunk.forEach((target) => {
          console.error("Expo Push Send Failed After Retry:", {
            token: target.token,
            reason: error instanceof Error ? error.message : String(error),
          });
        });
        continue;
      }

      const ticketRows = tickets.flatMap((ticket, index) => {
        const target = chunk[index];
        if (!target) return [];

        if (ticket.status === 'error') {
          summary.ticketErrors++;
          console.error("Expo Push Ticket Error:", {
            token: target.token,
            reason: ticket.details?.error || ticket.message || 'Unknown error',
          });
          return [];
        }

        if (!ticket.id) return [];
        summary.tickets++;
        return [{
          ticketId: ticket.id,
          token: target.token,
          userRole: target.payload.userRole,
          userId: target.payload.userId,
          notificationId: target.payload.notificationId,
        }];
      });

      if (ticketRows.length > 0) {
        await db.insert(expoPushTickets).values(ticketRows).onConflictDoNothing();
      }
    }

    debugLog("Expo push delivery summary", summary);
  } catch (err) {
    console.error("Error preparing push notifications:", err);
  }

  return summary;
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
}) {
  const recipients = await db
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
    message: `${title} is available for ${className} - ${sectionName} in ${subjectName}. Timer: ${durationMinutes} minutes.`,
    referenceId: onlineTestId,
  })));
}

async function sendExpoChunkWithRetry(messages: unknown[]) {
  try {
    return await sendExpoChunk(messages);
  } catch (firstError) {
    console.error("Expo Push Send Error, retrying once:", firstError);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return await sendExpoChunk(messages);
  }
}

async function sendExpoChunk(messages: unknown[]): Promise<ExpoTicket[]> {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push send failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  return Array.isArray(body.data) ? body.data : [];
}

export async function checkExpoPushReceipts() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const pendingTickets = await db.select()
    .from(expoPushTickets)
    .where(and(eq(expoPushTickets.status, 'PENDING'), lt(expoPushTickets.createdAt, cutoff)))
    .limit(300);

  if (pendingTickets.length === 0) return { checked: 0, failed: 0, delivered: 0 };

  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: pendingTickets.map(ticket => ticket.ticketId) }),
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
    console.error("Expo Push Receipt Error:", { token: ticket.token, reason });

    if (receipt.details?.error === 'DeviceNotRegistered') {
      if (ticket.userRole === 'STUDENT') studentTokenClears.push({ id: ticket.userId, token: ticket.token });
      else if (ticket.userRole === 'STAFF') staffTokenClears.push({ id: ticket.userId, token: ticket.token });
    }
  }

  const now = new Date();

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
  };
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
  const { announcements } = await import("@/db/schema");
  const { eq: eqOp } = await import("drizzle-orm");

  const [announcement] = await db.select().from(announcements).where(eqOp(announcements.id, announcementId));
  if (!announcement) {
    console.warn("Announcement notification skipped: announcement not found", { announcementId });
    return;
  }

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

  const type = announcement.title.toLowerCase().includes("timetable") ? 'EXAM_TIMETABLE' : 'ANNOUNCEMENT';
  const message = announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : '');

  const recipients = await resolveAnnouncementRecipients(announcement);
  const toPayload = (recipient: { userRole: NotificationPayload["userRole"]; userId: number }): NotificationPayload => ({
    institutionId: announcement.institutionId,
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
