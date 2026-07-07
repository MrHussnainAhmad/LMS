import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { announcements, classes, institutions, sections, studentProfileChangeRequests, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import type { JWTPayload } from "@/lib/auth";
import { reviewStudentProfileChangeRequestSchema } from "@/lib/validators/student";
import { and, eq } from "drizzle-orm";
import { generateStudentLoginRollNumber } from "@/lib/login-identifiers";

type RequestedFields = {
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  classId?: number;
  sectionId?: number;
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

async function notifyAnnouncement(announcementId: number) {
  const { processAnnouncementNotification } = await import("@/lib/notifications");
  await processAnnouncementNotification(announcementId);
}

export const PATCH = requireRole(["INSTITUTION"], async (
  req: NextRequest,
  { session, params }: { session: JWTPayload; params: Promise<{ id: string }> }
) => {
  const body = await req.json();
  const parsed = reviewStudentProfileChangeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [requestRow] = await db.select()
    .from(studentProfileChangeRequests)
    .where(and(
      eq(studentProfileChangeRequests.id, requestId),
      eq(studentProfileChangeRequests.institutionId, session.userId)
    ))
    .limit(1);

  if (!requestRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (requestRow.status !== "PENDING") {
    return NextResponse.json({ error: "Request has already been reviewed" }, { status: 400 });
  }

  const reviewedValues = {
    status: parsed.data.status,
    adminNote: parsed.data.adminNote || null,
    reviewedBy: session.userId,
    reviewedAt: new Date(),
  };

  if (parsed.data.status === "REJECTED") {
    await db.update(studentProfileChangeRequests)
      .set(reviewedValues)
      .where(eq(studentProfileChangeRequests.id, requestId));
    const [insertedAnnouncement] = await db.insert(announcements).values({
      institutionId: session.userId,
      senderRole: "INSTITUTION",
      senderId: session.userId,
      targetType: "USER",
      targetUserRole: "STUDENT",
      targetUserId: requestRow.studentId,
      title: "Profile change request rejected",
      content: parsed.data.adminNote ? `Your profile change request was rejected. Reason: ${parsed.data.adminNote}` : "Your profile change request was rejected.",
    }).returning({ id: announcements.id });
    await notifyAnnouncement(insertedAnnouncement.id);
    return NextResponse.json({ message: "Request rejected" });
  }

  const [student] = await db.select().from(students)
    .where(and(eq(students.id, requestRow.studentId), eq(students.institutionId, session.userId)))
    .limit(1);
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const requestedFields = requestRow.requestedFields as RequestedFields;
  const updates: Partial<typeof students.$inferInsert> = {};

  if (requestedFields.firstName || requestedFields.lastName) {
    const currentName = splitName(student.name);
    const firstName = requestedFields.firstName || currentName.firstName;
    const lastName = requestedFields.lastName ?? currentName.lastName;
    updates.name = `${firstName} ${lastName}`.trim();
  }

  if (requestedFields.fatherName) updates.fatherName = requestedFields.fatherName;

  if (requestedFields.classId) {
    const [classRow] = await db.select().from(classes)
      .where(and(eq(classes.id, requestedFields.classId), eq(classes.institutionId, session.userId)))
      .limit(1);
    if (!classRow) return NextResponse.json({ error: "Requested class not found" }, { status: 400 });
    updates.classId = requestedFields.classId;
  }

  if (requestedFields.sectionId) {
    const [sectionRow] = await db.select().from(sections)
      .where(and(eq(sections.id, requestedFields.sectionId), eq(sections.institutionId, session.userId)))
      .limit(1);
    if (!sectionRow) return NextResponse.json({ error: "Requested section not found" }, { status: 400 });
    if (updates.classId && sectionRow.classId !== updates.classId) {
      return NextResponse.json({ error: "Requested section does not belong to requested class" }, { status: 400 });
    }
    updates.sectionId = requestedFields.sectionId;
    if (!updates.classId) updates.classId = sectionRow.classId;
  }

  if (updates.classId || updates.sectionId) {
    const finalClassId = updates.classId ?? student.classId;
    const finalSectionId = updates.sectionId ?? student.sectionId;
    const [institution] = await db.select().from(institutions).where(eq(institutions.id, session.userId)).limit(1);
    const [classRow] = await db.select().from(classes).where(and(eq(classes.id, finalClassId), eq(classes.institutionId, session.userId))).limit(1);
    const [sectionRow] = await db.select().from(sections).where(and(eq(sections.id, finalSectionId), eq(sections.institutionId, session.userId))).limit(1);
    if (!institution || !classRow || !sectionRow || sectionRow.classId !== finalClassId) {
      return NextResponse.json({ error: "Requested section does not belong to requested class" }, { status: 400 });
    }
    updates.loginRollNumber = generateStudentLoginRollNumber({
      institution,
      classRow,
      sectionRow,
      yearOfJoining: student.yearOfJoining,
      classRollNumber: student.classRollNumber,
    });
  }

  try {
    await db.update(students).set(updates).where(eq(students.id, student.id));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Generated login roll number is already in use" }, { status: 409 });
    }
    throw error;
  }
  await db.update(studentProfileChangeRequests)
    .set(reviewedValues)
    .where(eq(studentProfileChangeRequests.id, requestId));
  const [insertedAnnouncement] = await db.insert(announcements).values({
    institutionId: session.userId,
    senderRole: "INSTITUTION",
    senderId: session.userId,
    targetType: "USER",
    targetUserRole: "STUDENT",
    targetUserId: student.id,
    title: "Profile change request approved",
    content: parsed.data.adminNote ? `Your profile change request was approved. Note: ${parsed.data.adminNote}` : "Your profile change request was approved and your profile was updated.",
  }).returning({ id: announcements.id });
  await notifyAnnouncement(insertedAnnouncement.id);

  return NextResponse.json({ message: "Request approved and student profile updated" });
});
