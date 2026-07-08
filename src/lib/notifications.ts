import { db } from "@/db";
import { expoPushTickets, notifications, staff, students } from "@/db/schema";
import { and, eq, inArray, lt } from "drizzle-orm";

type NotificationType = 'ANNOUNCEMENT' | 'EXAM_TIMETABLE' | 'ASSIGNMENT' | 'TEST' | 'MARKS' | 'ATTENDANCE' | 'GENERAL';

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
  tickets: number;
  ticketErrors: number;
};

export async function createNotification(payload: NotificationPayload) {
  const [inserted] = await db.insert(notifications).values(payload).returning({ id: notifications.id });
  await sendExpoPushNotifications([{ ...payload, notificationId: inserted?.id }]);
  return inserted;
}

export async function createBulkNotifications(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return;
  
  const insertedRows = await db.insert(notifications).values(payloads).returning({ id: notifications.id });
  const deliveries = payloads.map((payload, index) => ({
    ...payload,
    notificationId: insertedRows[index]?.id,
  }));
  await sendExpoPushNotifications(deliveries);
  return insertedRows;
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

  await createBulkNotifications(notifyList.map((record) => ({
    institutionId,
    userRole: "STUDENT",
    userId: record.studentId,
    type: "ATTENDANCE",
    title: "Attendance Alert",
    message: `You have been marked ${record.status} for ${dateLabel}.`,
  })));
}

async function sendExpoPushNotifications(payloads: NotificationDelivery[]): Promise<PushDeliverySummary> {
  const summary: PushDeliverySummary = {
    payloads: payloads.length,
    targets: 0,
    missingTokens: 0,
    tickets: 0,
    ticketErrors: 0,
  };

  try {
    const studentIds = Array.from(new Set(payloads.filter(p => p.userRole === 'STUDENT').map(p => p.userId)));
    const staffIds = Array.from(new Set(payloads.filter(p => p.userRole === 'STAFF').map(p => p.userId)));

    const studentTokens = new Map<number, string>();
    const staffTokens = new Map<number, string>();

    if (studentIds.length > 0) {
      const studentRecords = await db.select({ id: students.id, token: students.expoPushToken }).from(students).where(inArray(students.id, studentIds));
      studentRecords.forEach(r => { if (r.token) studentTokens.set(r.id, r.token) });
    }

    if (staffIds.length > 0) {
      const staffRecords = await db.select({ id: staff.id, token: staff.expoPushToken }).from(staff).where(inArray(staff.id, staffIds));
      staffRecords.forEach(r => { if (r.token) staffTokens.set(r.id, r.token) });
    }

    const targets = payloads.flatMap((payload) => {
      const token = payload.userRole === 'STUDENT'
        ? studentTokens.get(payload.userId)
        : payload.userRole === 'STAFF'
          ? staffTokens.get(payload.userId)
          : undefined;

      if (!token) {
        summary.missingTokens++;
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
  const { announcements, students, staff, staffAssignments, sections } = await import("@/db/schema");
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");

  const [announcement] = await db.select().from(announcements).where(eqOp(announcements.id, announcementId));
  if (!announcement) return;

  const payloads: NotificationPayload[] = [];
  const type = announcement.title.toLowerCase().includes("timetable") ? 'EXAM_TIMETABLE' : 'ANNOUNCEMENT';

  const pushToPayload = (userId: number, role: 'STUDENT' | 'STAFF') => {
    if (announcement.senderRole === role && announcement.senderId === userId) return;

    payloads.push({
      institutionId: announcement.institutionId,
      userRole: role,
      userId,
      type,
      title: announcement.title,
      message: announcement.content.substring(0, 100) + (announcement.content.length > 100 ? '...' : ''),
      referenceId: announcement.id,
    });
  };

  // 1. ALL
  if (announcement.targetType === 'ALL') {
    const allStudents = await db.select({ id: students.id }).from(students).where(eqOp(students.institutionId, announcement.institutionId));
    const allStaff = await db.select({ id: staff.id }).from(staff).where(eqOp(staff.institutionId, announcement.institutionId));
    allStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));
    allStaff.forEach(s => pushToPayload(s.id, 'STAFF'));
  }
  // 2. CAMPUS
  else if (announcement.targetType === 'CAMPUS' && announcement.targetCampusId) {
    const campusStudents = await db.select({ id: students.id }).from(students).where(andOp(eqOp(students.institutionId, announcement.institutionId), eqOp(students.campusId, announcement.targetCampusId)));
    const campusStaff = await db.select({ id: staff.id }).from(staff).where(andOp(eqOp(staff.institutionId, announcement.institutionId), eqOp(staff.campusId, announcement.targetCampusId)));
    campusStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));
    campusStaff.forEach(s => pushToPayload(s.id, 'STAFF'));
  }
  // 3. CLASS
  else if (announcement.targetType === 'CLASS' && announcement.targetClassId) {
    const classStudents = await db.select({ id: students.id }).from(students).where(andOp(eqOp(students.institutionId, announcement.institutionId), eqOp(students.classId, announcement.targetClassId)));
    classStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));

    const classStaff = await db.select({ id: staffAssignments.staffId })
      .from(staffAssignments)
      .innerJoin(sections, eqOp(staffAssignments.sectionId, sections.id))
      .where(andOp(eqOp(staffAssignments.institutionId, announcement.institutionId), eqOp(sections.classId, announcement.targetClassId)));
    Array.from(new Set(classStaff.map(s => s.id).filter((id): id is number => Boolean(id))))
      .forEach(id => pushToPayload(id, 'STAFF'));
  }
  // 4. SECTION
  else if (announcement.targetType === 'SECTION' && announcement.targetSectionId) {
    const secStudents = await db.select({ id: students.id }).from(students).where(andOp(eqOp(students.institutionId, announcement.institutionId), eqOp(students.sectionId, announcement.targetSectionId)));
    secStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));

    const sectionStaff = await db.select({ id: staffAssignments.staffId })
      .from(staffAssignments)
      .where(andOp(eqOp(staffAssignments.institutionId, announcement.institutionId), eqOp(staffAssignments.sectionId, announcement.targetSectionId)));
    Array.from(new Set(sectionStaff.map(s => s.id).filter((id): id is number => Boolean(id))))
      .forEach(id => pushToPayload(id, 'STAFF'));
  }
  // 5. USER
  else if (announcement.targetType === 'USER' && announcement.targetUserRole) {
    if (announcement.targetUserId) {
      pushToPayload(announcement.targetUserId, announcement.targetUserRole as 'STUDENT' | 'STAFF');
    } else if (announcement.targetUserRole === 'STAFF') {
      const roleStaff = await db.select({ id: staff.id }).from(staff).where(eqOp(staff.institutionId, announcement.institutionId));
      roleStaff.forEach(s => pushToPayload(s.id, 'STAFF'));
    } else if (announcement.targetUserRole === 'STUDENT') {
      const roleStudents = await db.select({ id: students.id }).from(students).where(eqOp(students.institutionId, announcement.institutionId));
      roleStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));
    }
  }

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
