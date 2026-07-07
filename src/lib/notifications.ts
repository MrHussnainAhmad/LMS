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
  return await db.insert(notifications).values(payload);
}

export async function createBulkNotifications(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return;
  
  // Drizzle supports bulk inserts
  return await db.insert(notifications).values(payloads);
}

export async function processAnnouncementNotification(announcementId: number) {
  const { announcements, students, staff } = await import("@/db/schema");
  const { eq, and } = await import("drizzle-orm");
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
  }
  // 4. SECTION
  else if (announcement.targetType === 'SECTION' && announcement.targetSectionId) {
    const secStudents = await db.select({ id: students.id }).from(students).where(andOp(eqOp(students.institutionId, announcement.institutionId), eqOp(students.sectionId, announcement.targetSectionId)));
    secStudents.forEach(s => pushToPayload(s.id, 'STUDENT'));
  }
  // 5. USER
  else if (announcement.targetType === 'USER' && announcement.targetUserRole && announcement.targetUserId) {
    pushToPayload(announcement.targetUserId, announcement.targetUserRole as 'STUDENT' | 'STAFF');
  }

  await createBulkNotifications(payloads);
}
