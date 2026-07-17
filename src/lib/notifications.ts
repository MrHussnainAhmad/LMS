import { db } from "@/db";
import { expoPushTickets, notifications, staff, students } from "@/db/schema";
import { resolveAnnouncementRecipients } from "@/lib/announcements";
import { and, eq, inArray, lt } from "drizzle-orm";
import { after } from "next/server";

type NotificationType = 'ANNOUNCEMENT' | 'EXAM_TIMETABLE' | 'ASSIGNMENT' | 'TEST' | 'MARKS' | 'ATTENDANCE' | 'GENERAL' | 'LEAVE_REQUEST';

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

export async function createNotification(payload: NotificationPayload) {
  console.info("Creating single notification", {
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
  console.info("Creating bulk notifications", {
    payloads: payloads.length,
    types: Array.from(new Set(payloads.map((payload) => payload.type))),
    studentRecipients: payloads.filter((payload) => payload.userRole === "STUDENT").length,
    staffRecipients: payloads.filter((payload) => payload.userRole === "STAFF").length,
  });

  if (payloads.length === 0) return;
  
  const insertedRows = await db.insert(notifications).values(payloads).returning({ id: notifications.id });
  console.info("Bulk notification rows inserted", {
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

function scheduleExpoPushNotifications(deliveries: NotificationDelivery[]) {
  after(async () => {
    try {
      await sendExpoPushNotifications(deliveries);
    } catch (error) {
      console.error("Expo push delivery failed:", error);
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

    console.info("Expo push token lookup", {
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
      console.info("Expo push delivery summary", summary);
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

    console.info("Expo push delivery summary", summary);
  } catch (err) {
    console.error("Error preparing push notifications:", err);
  }

  return summary;
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

  console.info("Processing online test notification", {
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
  let delivered = 0;
  let failed = 0;
  let tokensCleaned = 0;

  await Promise.all(pendingTickets.map(async (ticket) => {
    const receipt = receipts[ticket.ticketId];
    if (!receipt) return;

    if (receipt.status === 'ok') {
      delivered++;
      await db.update(expoPushTickets)
        .set({ status: 'DELIVERED', checkedAt: new Date() })
        .where(eq(expoPushTickets.id, ticket.id));
      return;
    }

    failed++;
    const reason = receipt.details?.error || receipt.message || 'Unknown receipt error';
    await db.update(expoPushTickets)
      .set({ status: 'FAILED', error: reason, checkedAt: new Date() })
      .where(eq(expoPushTickets.id, ticket.id));

    console.error("Expo Push Receipt Error:", { token: ticket.token, reason });

    if (receipt.details?.error === 'DeviceNotRegistered') {
      tokensCleaned++;
      if (ticket.userRole === 'STUDENT') {
        await db.update(students)
          .set({ expoPushToken: null })
          .where(and(eq(students.id, ticket.userId), eq(students.expoPushToken, ticket.token)));
      } else if (ticket.userRole === 'STAFF') {
        await db.update(staff)
          .set({ expoPushToken: null })
          .where(and(eq(staff.id, ticket.userId), eq(staff.expoPushToken, ticket.token)));
      }
    }
  }));

  return { ticketsChecked: pendingTickets.length, tokensCleaned, errors: failed };
}

export async function processAnnouncementNotification(announcementId: number) {
  const { announcements } = await import("@/db/schema");
  const { eq: eqOp } = await import("drizzle-orm");

  const [announcement] = await db.select().from(announcements).where(eqOp(announcements.id, announcementId));
  if (!announcement) {
    console.warn("Announcement notification skipped: announcement not found", { announcementId });
    return;
  }

  console.info("Processing announcement notification", {
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

  const payloads: NotificationPayload[] = [];
  const type = announcement.title.toLowerCase().includes("timetable") ? 'EXAM_TIMETABLE' : 'ANNOUNCEMENT';

  const recipients = await resolveAnnouncementRecipients(announcement);
  recipients.forEach((recipient) => {
    payloads.push({
      institutionId: announcement.institutionId,
      userRole: recipient.userRole,
      userId: recipient.userId,
      type,
      title: announcement.title,
      message: announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : ''),
      referenceId: announcement.id,
    });
  });

  const insertedRows = await createBulkNotifications(payloads);
  console.info("Announcement notification fan-out", {
    announcementId: announcement.id,
    targetType: announcement.targetType,
    senderRole: announcement.senderRole,
    senderId: announcement.senderId,
    recipients: payloads.length,
    notificationsCreated: insertedRows?.length ?? 0,
  });
}
