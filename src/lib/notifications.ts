import { db } from "@/db";
import { notifications } from "@/db/schema";

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

export async function createNotification(payload: NotificationPayload) {
  const result = await db.insert(notifications).values(payload);
  await sendExpoPushNotifications([payload]);
  return result;
}

export async function createBulkNotifications(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return;
  
  // Drizzle supports bulk inserts
  const result = await db.insert(notifications).values(payloads);
  await sendExpoPushNotifications(payloads);
  return result;
}

async function sendExpoPushNotifications(payloads: NotificationPayload[]) {
  try {
    const { students, staff } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");

    const studentIds = payloads.filter(p => p.userRole === 'STUDENT').map(p => p.userId);
    const staffIds = payloads.filter(p => p.userRole === 'STAFF').map(p => p.userId);

    const tokens: string[] = [];

    if (studentIds.length > 0) {
      const studentRecords = await db.select({ token: students.expoPushToken }).from(students).where(inArray(students.id, studentIds));
      studentRecords.forEach(r => { if (r.token) tokens.push(r.token) });
    }

    if (staffIds.length > 0) {
      const staffRecords = await db.select({ token: staff.expoPushToken }).from(staff).where(inArray(staff.id, staffIds));
      staffRecords.forEach(r => { if (r.token) tokens.push(r.token) });
    }

    if (tokens.length === 0) return;

    // Expo Push expects an array of messages
    // Grouping all tokens into one message if the payload title/body is same, but here we just take the first payload's title/message for bulk
    // This is a simplified approach assuming bulk notifications are typically the same message broadcasted.
    const samplePayload = payloads[0];

    const pushMessages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: samplePayload.title,
      body: samplePayload.message,
      data: { type: samplePayload.type, referenceId: samplePayload.referenceId },
    }));

    // Send in chunks of 100 as per Expo guidelines
    const CHUNK_SIZE = 100;
    for (let i = 0; i < pushMessages.length; i += CHUNK_SIZE) {
      const chunk = pushMessages.slice(i, i + CHUNK_SIZE);
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      }).catch(err => console.error("Expo Push Error:", err));
    }
  } catch (err) {
    console.error("Error preparing push notifications:", err);
  }
}

export async function processAnnouncementNotification(announcementId: number) {
  const { announcements, students, staff, staffAssignments, sections } = await import("@/db/schema");
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");

  const [announcement] = await db.select().from(announcements).where(eqOp(announcements.id, announcementId));
  if (!announcement) return;

  const payloads: NotificationPayload[] = [];
  const type = announcement.title.toLowerCase().includes("timetable") ? 'EXAM_TIMETABLE' : 'ANNOUNCEMENT';

  const pushToPayload = (userId: number, role: 'STUDENT' | 'STAFF') => {
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

  await createBulkNotifications(payloads);
}
