import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assignments, classes, sections, subjects, staffAssignments, submissions, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Get assigned slots for dropdowns
    const assignedSlotsRaw = await db.select({
      sectionId: sections.id,
      sectionName: sections.name,
      classId: classes.id,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

    // Extract unique sections
    const sectionOptionsMap = new Map();
    assignedSlotsRaw.forEach(slot => {
      if (!sectionOptionsMap.has(slot.sectionId)) {
        sectionOptionsMap.set(slot.sectionId, {
          id: slot.sectionId,
          name: slot.sectionName,
          classId: slot.classId,
          className: slot.className
        });
      }
    });
    const sectionOptions = Array.from(sectionOptionsMap.values());

    // Extract unique subjects
    const subjectOptionsMap = new Map();
    assignedSlotsRaw.forEach(slot => {
      if (slot.subjectId && slot.subjectName) {
        if (!subjectOptionsMap.has(slot.subjectId)) {
          subjectOptionsMap.set(slot.subjectId, {
            id: slot.subjectId,
            name: slot.subjectName
          });
        }
      }
    });
    const subjectOptions = Array.from(subjectOptionsMap.values());

    // 2. Fetch created assignments
    const createdAssignments = await db.select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      dueAt: assignments.dueAt,
      classId: assignments.classId,
      sectionId: assignments.sectionId,
      subjectId: assignments.subjectId,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
    })
      .from(assignments)
      .innerJoin(classes, eq(assignments.classId, classes.id))
      .leftJoin(sections, eq(assignments.sectionId, sections.id))
      .leftJoin(subjects, eq(assignments.subjectId, subjects.id))
      .where(and(eq(assignments.staffId, session.userId), eq(assignments.institutionId, session.institutionId)))
      .orderBy(desc(assignments.createdAt));

    // 3. Fetch submissions and students to attach to assignments
    const detailedSubmissions = await db.select({
      submissionId: submissions.id,
      assignmentId: submissions.assignmentId,
      studentId: students.id,
      studentName: students.name,
      rollNumber: students.classRollNumber,
      fileKey: submissions.fileKey,
      submittedAt: submissions.createdAt
    })
      .from(submissions)
      .innerJoin(students, eq(submissions.studentId, students.id))
      .where(eq(submissions.institutionId, session.institutionId));

    const studentRows = await db.select({
      id: students.id,
      name: students.name,
      classId: students.classId,
      sectionId: students.sectionId,
      classRollNumber: students.classRollNumber
    }).from(students).where(eq(students.institutionId, session.institutionId));

    const studentsByClass = new Map<number, typeof studentRows>();
    for (const student of studentRows) {
      const existing = studentsByClass.get(student.classId) || [];
      existing.push(student);
      studentsByClass.set(student.classId, existing);
    }

    const assignmentsWithDetails = createdAssignments.map(assignment => {
      const assignmentSubmissions = detailedSubmissions.filter(s => s.assignmentId === assignment.id);
      assignmentSubmissions.sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
      
      const submittedStudentIds = new Set(assignmentSubmissions.map(s => s.studentId));
      
      const targetStudents = (studentsByClass.get(assignment.classId) || [])
        .filter(student => !assignment.sectionId || student.sectionId === assignment.sectionId);
      
      const pendingStudents = targetStudents.filter(student => !submittedStudentIds.has(student.id));
      pendingStudents.sort((a, b) => String(a.classRollNumber).localeCompare(String(b.classRollNumber), undefined, { numeric: true }));

      return {
        ...assignment,
        submittedStudents: assignmentSubmissions.map(s => ({
          ...s,
          isLate: new Date(s.submittedAt) > new Date(assignment.dueAt)
        })),
        pendingStudents: pendingStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.classRollNumber
        }))
      };
    });

    return NextResponse.json({ 
      assignments: assignmentsWithDetails,
      sectionOptions,
      subjectOptions
    });
  } catch (error) {
    console.error("Error fetching staff assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
});

export const POST = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    let { sectionId, subjectId, title, description, dueAt } = body;

    sectionId = Number(sectionId);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      return NextResponse.json({ error: "Section is required" }, { status: 400 });
    }

    if (subjectId) {
      subjectId = Number(subjectId);
      if (!Number.isInteger(subjectId) || subjectId <= 0) subjectId = null;
    }

    if (!title || typeof title !== "string") return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!dueAt || typeof dueAt !== "string") return NextResponse.json({ error: "Due date is required" }, { status: 400 });

    // Verify staff has access to this section
    const conditions = [
      eq(staffAssignments.staffId, session.userId),
      eq(staffAssignments.institutionId, session.institutionId),
      eq(staffAssignments.sectionId, sectionId),
    ];
    if (subjectId) conditions.push(eq(staffAssignments.subjectId, subjectId));

    const [assignment] = await db.select().from(staffAssignments).where(and(...conditions)).limit(1);
    if (!assignment) {
      return NextResponse.json({ error: "This class or subject is not assigned to you" }, { status: 403 });
    }

    const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
    if (!section || section.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Invalid class section" }, { status: 400 });
    }

    const [insertedAssignment] = await db.insert(assignments).values({
      institutionId: session.institutionId,
      staffId: session.userId,
      classId: section.classId,
      sectionId,
      subjectId: subjectId || null,
      title: title.trim(),
      description: description ? description.trim() : null,
      dueAt: new Date(dueAt),
    }).returning({ id: assignments.id });

    const sectionStudents = await db.select({ id: students.id }).from(students).where(eq(students.sectionId, sectionId));
    const { createBulkNotifications } = await import("@/lib/notifications");
    await createBulkNotifications(sectionStudents.map((s: any) => ({
      institutionId: session.institutionId!,
      userRole: "STUDENT",
      userId: s.id,
      type: "ASSIGNMENT",
      title: "New Assignment",
      message: `A new assignment "${title}" has been posted. Due: ${new Date(dueAt).toLocaleDateString()}`,
      referenceId: insertedAssignment.id,
    })));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
});
