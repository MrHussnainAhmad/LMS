"use server";

import { db } from "@/db";
import {
  assignments,
  announcements,
  classes,
  marks,
  sections,
  staffAssignments,
  students,
  subjects,
  submissions,
  tests,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const STAFF_TEST_TYPES = new Set(["DAILY", "WEEKLY", "QUIZ"]);
const INSTITUTION_EXAM_TYPES = new Set(["MONTHLY", "MID", "FINAL"]);

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid exam start date");
  return new Date(Date.UTC(year, month - 1, day));
}

function formatLocalDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function nextExamDate(value: Date) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 0) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function buildExamDates(startDate: string, count: number) {
  let current = parseLocalDate(startDate);
  if (current.getUTCDay() === 0) current = nextExamDate(current);

  const dates: string[] = [];
  for (let index = 0; index < count; index++) {
    dates.push(formatLocalDate(current));
    if (index < count - 1) current = nextExamDate(current);
  }

  return {
    dates,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

function toNumber(value: FormDataEntryValue | null, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function requireStaffSection(staffId: number, institutionId: number, sectionId: number, subjectId?: number) {
  const conditions = [
    eq(staffAssignments.staffId, staffId),
    eq(staffAssignments.institutionId, institutionId),
    eq(staffAssignments.sectionId, sectionId),
  ];

  if (subjectId) conditions.push(eq(staffAssignments.subjectId, subjectId));

  const [assignment] = await db.select().from(staffAssignments).where(and(...conditions)).limit(1);
  if (!assignment) {
    throw new Error("This class or subject is not assigned to this staff account");
  }

  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!section || section.institutionId !== institutionId) {
    throw new Error("Invalid class section");
  }

  return section;
}

async function requireInstitutionClass(institutionId: number, classId: number) {
  const [classRow] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId))).limit(1);
  if (!classRow) throw new Error("Invalid class");
  return classRow;
}

async function createExamAnnouncement(
  institutionId: number,
  classId: number,
  title: string,
  type: string,
  startDate: string,
  endDate: string,
  subjectCount: number,
  status: "created" | "updated" | "cancelled"
) {
  const [classRow] = await db.select({ name: classes.name }).from(classes).where(and(eq(classes.id, classId), eq(classes.institutionId, institutionId))).limit(1);
  const label = type.charAt(0) + type.slice(1).toLowerCase();
  const action = status === "created" ? "scheduled" : status === "updated" ? "updated" : "cancelled";

  await db.insert(announcements).values({
    institutionId,
    senderRole: "INSTITUTION",
    senderId: institutionId,
    targetType: "CLASS",
    targetClassId: classId,
    title: `${label} exam ${action}: ${title}`,
    content: status === "cancelled"
      ? `${title} for ${classRow?.name || "this class"} has been cancelled.`
      : `${title} for ${classRow?.name || "this class"} has been ${action}. Exam dates run from ${startDate} to ${endDate} for ${subjectCount} book${subjectCount === 1 ? "" : "s"}. Sundays are skipped in the timetable.`,
  });
}

async function requireInstitutionSubjects(institutionId: number, subjectIds: number[]) {
  const uniqueSubjectIds = Array.from(new Set(subjectIds));
  const rows = await db.select().from(subjects).where(and(eq(subjects.institutionId, institutionId), inArray(subjects.id, uniqueSubjectIds)));
  if (rows.length !== uniqueSubjectIds.length) {
    throw new Error("One or more subjects do not belong to this institution");
  }
  return uniqueSubjectIds;
}

export async function createStaffAssignmentAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) throw new Error("Unauthorized");

  const sectionId = toNumber(formData.get("sectionId"), "Section");
  const subjectId = toOptionalNumber(formData.get("subjectId"));
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueAtRaw = String(formData.get("dueAt") || "");
  if (!title || !dueAtRaw) throw new Error("Title and due date are required");

  const section = await requireStaffSection(session.userId, session.institutionId, sectionId, subjectId ?? undefined);
  if (subjectId) await requireInstitutionSubjects(session.institutionId, [subjectId]);

  await db.insert(assignments).values({
    institutionId: session.institutionId,
    staffId: session.userId,
    classId: section.classId,
    sectionId,
    subjectId,
    title,
    description: description || null,
    dueAt: new Date(dueAtRaw),
  });

  revalidatePath("/staff/assignments");
  revalidatePath("/student/submissions");
}

export async function createStaffAssessmentAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) throw new Error("Unauthorized");

  const sectionId = toNumber(formData.get("sectionId"), "Section");
  const type = String(formData.get("type") || "");
  if (!STAFF_TEST_TYPES.has(type)) throw new Error("Staff can only create Daily, Weekly, or Quiz assessments");

  const title = String(formData.get("title") || "").trim();
  const maxMarks = Number(formData.get("maxMarks"));
  const date = String(formData.get("date") || "");
  const subjectIds = formData.getAll("subjectIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (!title || !date || !Number.isFinite(maxMarks) || maxMarks <= 0 || subjectIds.length === 0) {
    throw new Error("Assessment title, date, marks, and subjects are required");
  }

  const section = await requireStaffSection(session.userId, session.institutionId, sectionId);
  await requireInstitutionSubjects(session.institutionId, subjectIds);

  for (const subjectId of Array.from(new Set(subjectIds))) {
    await requireStaffSection(session.userId, session.institutionId, sectionId, subjectId);
    await db.insert(tests).values({
      institutionId: session.institutionId,
      classId: section.classId,
      sectionId,
      subjectId,
      staffId: session.userId,
      createdByRole: "STAFF",
      type: type as "DAILY" | "WEEKLY" | "QUIZ",
      title,
      maxMarks,
      date,
    });
  }

  revalidatePath("/staff/marks");
}

export async function createInstitutionExamAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const classId = toNumber(formData.get("classId"), "Class");
  const type = String(formData.get("type") || "");
  if (!INSTITUTION_EXAM_TYPES.has(type)) throw new Error("Institution exams must be Monthly, Mid, or Final");

  const title = String(formData.get("title") || "").trim();
  const maxMarks = Number(formData.get("maxMarks"));
  const date = String(formData.get("date") || "");
  const subjectIds = formData.getAll("subjectIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (!title || !date || !Number.isFinite(maxMarks) || maxMarks <= 0 || subjectIds.length === 0) {
    throw new Error("Exam title, date, marks, and subjects are required");
  }

  await requireInstitutionClass(institutionId, classId);
  const validSubjectIds = await requireInstitutionSubjects(institutionId, subjectIds);
  const examSchedule = buildExamDates(date, validSubjectIds.length);

  for (const [index, subjectId] of validSubjectIds.entries()) {
    await db.insert(tests).values({
      institutionId,
      classId,
      sectionId: null,
      subjectId,
      staffId: null,
      createdByRole: "INSTITUTION",
      type: type as "MONTHLY" | "MID" | "FINAL",
      title,
      maxMarks,
      date: examSchedule.dates[index],
      endDate: examSchedule.endDate,
    });
  }

  await createExamAnnouncement(institutionId, classId, title, type, examSchedule.startDate, examSchedule.endDate, validSubjectIds.length, "created");

  revalidatePath("/institution/timetable");
  revalidatePath("/institution/exams");
  revalidatePath("/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/marks");
  revalidatePath("/staff/exams");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/marks");
  revalidatePath("/student/exams");
}

function parseExamIds(value: FormDataEntryValue | null) {
  const ids = String(value || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) throw new Error("Exam selection is required");
  return Array.from(new Set(ids));
}

export async function updateInstitutionExamAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const examIds = parseExamIds(formData.get("examIds"));
  const classId = toNumber(formData.get("classId"), "Class");
  const type = String(formData.get("type") || "");
  if (!INSTITUTION_EXAM_TYPES.has(type)) throw new Error("Institution exams must be Monthly, Mid, or Final");

  const title = String(formData.get("title") || "").trim();
  const maxMarks = Number(formData.get("maxMarks"));
  const date = String(formData.get("date") || "");
  const subjectIds = formData.getAll("subjectIds").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (!title || !date || !Number.isFinite(maxMarks) || maxMarks <= 0 || subjectIds.length === 0) {
    throw new Error("Exam title, date, marks, and subjects are required");
  }

  const existingRows = await db.select().from(tests).where(and(
    eq(tests.institutionId, institutionId),
    eq(tests.createdByRole, "INSTITUTION"),
    inArray(tests.id, examIds)
  ));
  if (existingRows.length !== examIds.length) throw new Error("One or more exam rows were not found");

  await requireInstitutionClass(institutionId, classId);
  const validSubjectIds = await requireInstitutionSubjects(institutionId, subjectIds);
  const examSchedule = buildExamDates(date, validSubjectIds.length);
  const existingBySubject = new Map(existingRows.map((row) => [row.subjectId, row]));
  const nextSubjectSet = new Set(validSubjectIds);

  for (const [index, subjectId] of validSubjectIds.entries()) {
    const existing = existingBySubject.get(subjectId);
    const values = {
      classId,
      sectionId: null,
      subjectId,
      staffId: null,
      createdByRole: "INSTITUTION" as const,
      type: type as "MONTHLY" | "MID" | "FINAL",
      title,
      maxMarks,
      date: examSchedule.dates[index],
      endDate: examSchedule.endDate,
    };

    if (existing) {
      await db.update(tests)
        .set(values)
        .where(and(eq(tests.id, existing.id), eq(tests.institutionId, institutionId)));
    } else {
      await db.insert(tests).values({
        institutionId,
        ...values,
      });
    }
  }

  const removedIds = existingRows.filter((row) => !nextSubjectSet.has(row.subjectId)).map((row) => row.id);
  if (removedIds.length > 0) {
    await db.delete(tests).where(and(
      eq(tests.institutionId, institutionId),
      eq(tests.createdByRole, "INSTITUTION"),
      inArray(tests.id, removedIds)
    ));
  }

  await createExamAnnouncement(institutionId, classId, title, type, examSchedule.startDate, examSchedule.endDate, validSubjectIds.length, "updated");

  revalidatePath("/institution/timetable");
  revalidatePath("/institution/exams");
  revalidatePath("/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/marks");
  revalidatePath("/staff/exams");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/marks");
  revalidatePath("/student/exams");
}

export async function deleteInstitutionExamAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") throw new Error("Unauthorized");

  const institutionId = session.userId;
  const examIds = parseExamIds(formData.get("examIds"));
  const existingRows = await db.select().from(tests).where(and(
    eq(tests.institutionId, institutionId),
    eq(tests.createdByRole, "INSTITUTION"),
    inArray(tests.id, examIds)
  ));

  await db.delete(tests).where(and(
    eq(tests.institutionId, institutionId),
    eq(tests.createdByRole, "INSTITUTION"),
    inArray(tests.id, examIds)
  ));

  const first = existingRows[0];
  if (first) {
    await createExamAnnouncement(
      institutionId,
      first.classId,
      first.title,
      first.type,
      first.date,
      first.endDate || first.date,
      existingRows.length,
      "cancelled"
    );
  }

  revalidatePath("/institution/timetable");
  revalidatePath("/institution/exams");
  revalidatePath("/announcements");
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/marks");
  revalidatePath("/staff/exams");
  revalidatePath("/student/dashboard");
  revalidatePath("/student/marks");
  revalidatePath("/student/exams");
}

function parseMarksCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const [rollNumber, obtainedRaw, totalRaw] = line.split(",").map((part) => part?.trim());
    if (!rollNumber || !obtainedRaw || !totalRaw) {
      throw new Error(`CSV row ${index + 1} must contain rollnumber, obtained marks, total marks`);
    }
    const marksObtained = Number(obtainedRaw);
    const totalMarks = Number(totalRaw);
    if (!Number.isFinite(marksObtained) || !Number.isFinite(totalMarks) || marksObtained < 0 || totalMarks <= 0 || marksObtained > totalMarks) {
      throw new Error(`CSV row ${index + 1} has invalid marks`);
    }
    return { rollNumber, marksObtained, totalMarks };
  });
}

async function requireMarkableTest(session: { userId: number; institutionId: number }, testId: number) {
  const [test] = await db.select().from(tests).where(and(eq(tests.id, testId), eq(tests.institutionId, session.institutionId))).limit(1);
  if (!test) throw new Error("Assessment not found");

  if (test.createdByRole === "STAFF" && test.staffId !== session.userId) {
    throw new Error("Only the staff member who created this assessment can mark it");
  }

  if (test.createdByRole === "INSTITUTION") {
    const assigned = await db.select()
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .where(
        and(
          eq(staffAssignments.staffId, session.userId),
          eq(staffAssignments.institutionId, session.institutionId),
          eq(staffAssignments.subjectId, test.subjectId),
          eq(sections.classId, test.classId)
        )
      );
    if (assigned.length === 0) throw new Error("This exam subject is not assigned to this staff account");
  }

  return test;
}

async function saveMarksForRecords(
  session: { institutionId: number },
  test: typeof tests.$inferSelect,
  records: { rollNumber: string; marksObtained: number; totalMarks: number }[]
) {
  if (records.length === 0) throw new Error("No marks provided");

  const expectedTotal = Number(test.maxMarks);
  const badTotal = records.find((record) => record.totalMarks !== expectedTotal);
  if (badTotal) throw new Error(`Total marks must match assessment total of ${expectedTotal}`);

  const rollNumbers = records.map((record) => record.rollNumber);
  const uniqueRollNumbers = new Set(rollNumbers);
  if (uniqueRollNumbers.size !== rollNumbers.length) {
    throw new Error("Duplicate roll numbers are not allowed");
  }

  const studentRows = await db.select().from(students).where(
    and(
      eq(students.institutionId, session.institutionId),
      eq(students.classId, test.classId),
      inArray(students.classRollNumber, rollNumbers)
    )
  );

  if (studentRows.length !== records.length) {
    throw new Error("Every roll number must match a student in this class");
  }

  const studentByRoll = new Map(studentRows.map((student) => [student.classRollNumber, student]));

  for (const record of records) {
    const student = studentByRoll.get(record.rollNumber);
    if (!student) throw new Error(`Roll number ${record.rollNumber} was not found`);
    await db.insert(marks).values({
      institutionId: session.institutionId,
      testId: test.id,
      studentId: student.id,
      marksObtained: record.marksObtained,
      totalMarks: record.totalMarks,
    }).onConflictDoUpdate({
      target: [marks.testId, marks.studentId],
      set: {
        marksObtained: record.marksObtained,
        totalMarks: record.totalMarks,
      },
    });
  }

  revalidatePath("/staff/marks");
  revalidatePath("/student/marks");
}

export async function uploadMarksCsvAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) throw new Error("Unauthorized");
  const staffSession = { userId: session.userId, institutionId: session.institutionId };

  const testId = toNumber(formData.get("testId"), "Assessment");
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSV file is required");

  const test = await requireMarkableTest(staffSession, testId);
  const records = parseMarksCsv(await file.text());
  await saveMarksForRecords(staffSession, test, records);
}

export async function enterMarksManuallyAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "STAFF" || !session.institutionId) throw new Error("Unauthorized");
  const staffSession = { userId: session.userId, institutionId: session.institutionId };

  const testId = toNumber(formData.get("testId"), "Assessment");
  const totalMarks = Number(formData.get("totalMarks"));
  const rollNumbers = formData.getAll("rollNumber").map((value) => String(value).trim());
  const obtainedMarks = formData.getAll("marksObtained").map((value) => String(value).trim());

  if (!Number.isFinite(totalMarks) || totalMarks <= 0) throw new Error("Total marks are required");
  if (rollNumbers.length !== obtainedMarks.length) throw new Error("Invalid marks form");

  const records = rollNumbers.map((rollNumber, index) => {
    const marksObtained = Number(obtainedMarks[index]);
    if (!rollNumber || !Number.isFinite(marksObtained) || marksObtained < 0 || marksObtained > totalMarks) {
      throw new Error(`Invalid marks for roll number ${rollNumber || index + 1}`);
    }
    return { rollNumber, marksObtained, totalMarks };
  });

  const test = await requireMarkableTest(staffSession, testId);
  await saveMarksForRecords(staffSession, test, records);
}

export async function saveStudentSubmission(assignmentId: number, fileKey: string) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) throw new Error("Unauthorized");

  const [student] = await db.select().from(students).where(eq(students.id, session.userId)).limit(1);
  if (!student || student.institutionId !== session.institutionId) throw new Error("Student not found");

  const [assignment] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.institutionId, session.institutionId))).limit(1);
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.classId !== student.classId) throw new Error("This assignment is not for your class");
  if (assignment.sectionId && assignment.sectionId !== student.sectionId) throw new Error("This assignment is not for your section");

  await db.insert(submissions).values({
    institutionId: session.institutionId,
    assignmentId,
    studentId: student.id,
    fileKey,
  }).onConflictDoUpdate({
    target: [submissions.assignmentId, submissions.studentId],
    set: { fileKey },
  });

  revalidatePath("/student/submissions");
}
