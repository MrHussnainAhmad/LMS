import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { assignments, classes, sections, subjects, staffAssignments, submissions, students } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray, lt, or } from "drizzle-orm";
import { verifyCloudinarySubmission } from "@/app/actions/assessment-actions";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const view = req.nextUrl.searchParams.get("view");
    const sectionIdParam = req.nextUrl.searchParams.get("sectionId");
    if (view || sectionIdParam) {
      if (view && view !== "metadata") return NextResponse.json({ error: "Invalid view" }, { status: 400 });
      const assignedSlotsRaw = await db.select({
        sectionId: sections.id, sectionName: sections.name, classId: classes.id, className: classes.name,
        subjectId: subjects.id, subjectName: subjects.name,
      }).from(staffAssignments)
        .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
        .innerJoin(classes, eq(sections.classId, classes.id))
        .leftJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
        .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));
      const sectionOptions = Array.from(new Map(assignedSlotsRaw.map((slot) => [slot.sectionId, {
        id: slot.sectionId, name: slot.sectionName, classId: slot.classId, className: slot.className,
      }])).values());
      const subjectOptions = Array.from(new Map(assignedSlotsRaw.filter((slot) => slot.subjectId && slot.subjectName)
        .map((slot) => [slot.subjectId!, { id: slot.subjectId!, name: slot.subjectName! }])).values());
      if (view === "metadata") return NextResponse.json({ sectionOptions, subjectOptions });

      const sectionId = Number(sectionIdParam);
      if (!Number.isInteger(sectionId) || sectionId <= 0 || !assignedSlotsRaw.some((slot) => slot.sectionId === sectionId)) {
        return NextResponse.json({ error: "Invalid or unassigned sectionId" }, { status: 400 });
      }
      const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return NextResponse.json({ error: "limit must be an integer from 1 to 50" }, { status: 400 });
      const subjectIdParam = req.nextUrl.searchParams.get("subjectId");
      const subjectId = subjectIdParam ? Number(subjectIdParam) : null;
      if (subjectIdParam && (!Number.isInteger(subjectId) || subjectId! <= 0)) return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
      const cursor = req.nextUrl.searchParams.get("cursor");
      let cursorValue: { createdAt: string; id: number } | null = null;
      if (cursor) try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (typeof parsed.createdAt !== "string" || !Number.isInteger(parsed.id) || Number.isNaN(new Date(parsed.createdAt).getTime())) throw new Error();
        cursorValue = parsed;
      } catch { return NextResponse.json({ error: "Invalid cursor" }, { status: 400 }); }
      const rows = await db.select({
        id: assignments.id, title: assignments.title, description: assignments.description, referenceFileUrl: assignments.referenceFileUrl,
        referenceFileName: assignments.referenceFileName, dueAt: assignments.dueAt, createdAt: assignments.createdAt,
        classId: assignments.classId, sectionId: assignments.sectionId, subjectId: assignments.subjectId,
        className: classes.name, sectionName: sections.name, subjectName: subjects.name,
      }).from(assignments)
        .innerJoin(classes, eq(assignments.classId, classes.id)).leftJoin(sections, eq(assignments.sectionId, sections.id)).leftJoin(subjects, eq(assignments.subjectId, subjects.id))
        .where(and(eq(assignments.staffId, session.userId), eq(assignments.institutionId, session.institutionId), eq(assignments.sectionId, sectionId),
          ...(subjectId ? [eq(assignments.subjectId, subjectId)] : []),
          ...(cursorValue ? [or(lt(assignments.createdAt, new Date(cursorValue.createdAt)), and(eq(assignments.createdAt, new Date(cursorValue.createdAt)), lt(assignments.id, cursorValue.id)))] : []),
        )).orderBy(desc(assignments.createdAt), desc(assignments.id)).limit(limit + 1);
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const assignmentIds = pageRows.map((row) => row.id);
      const submissionRows = assignmentIds.length ? await db.select({ submissionId: submissions.id, assignmentId: submissions.assignmentId, studentId: students.id, studentName: students.name, rollNumber: students.classRollNumber, fileKey: submissions.fileKey, submittedAt: submissions.createdAt })
        .from(submissions).innerJoin(students, eq(submissions.studentId, students.id)).where(and(eq(submissions.institutionId, session.institutionId), inArray(submissions.assignmentId, assignmentIds))) : [];
      const roster = await db.select({ id: students.id, name: students.name, classRollNumber: students.classRollNumber }).from(students)
        .where(and(eq(students.institutionId, session.institutionId), eq(students.sectionId, sectionId)));
      const byAssignment = new Map<number, typeof submissionRows>();
      submissionRows.forEach((row) => byAssignment.set(row.assignmentId, [...(byAssignment.get(row.assignmentId) ?? []), row]));
      const responseAssignments = pageRows.map((assignment) => {
        const submittedStudents = byAssignment.get(assignment.id) ?? [];
        const submittedIds = new Set(submittedStudents.map((row) => row.studentId));
        return { ...assignment, submittedStudents: submittedStudents.map((row) => ({ ...row, isLate: new Date(row.submittedAt) > new Date(assignment.dueAt) })),
          pendingStudents: roster.filter((student) => !submittedIds.has(student.id)).map((student) => ({ studentId: student.id, studentName: student.name, rollNumber: student.classRollNumber })) };
      });
      const last = pageRows.at(-1);
      return NextResponse.json({ assignments: responseAssignments, sectionOptions, subjectOptions, page: { limit, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url") : null } });
    }

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
      referenceFileUrl: assignments.referenceFileUrl,
      referenceFileName: assignments.referenceFileName,
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

    for (const list of studentsByClass.values()) {
      list.sort((a, b) => {
        const numA = parseInt(a.classRollNumber, 10);
        const numB = parseInt(b.classRollNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.classRollNumber.localeCompare(b.classRollNumber);
      });
    }

    const submissionsByAssignment = new Map<number, typeof detailedSubmissions>();
    for (const sub of detailedSubmissions) {
      const existing = submissionsByAssignment.get(sub.assignmentId) || [];
      existing.push(sub);
      submissionsByAssignment.set(sub.assignmentId, existing);
    }

    for (const list of submissionsByAssignment.values()) {
      list.sort((a, b) => {
        const numA = parseInt(a.rollNumber as any, 10);
        const numB = parseInt(b.rollNumber as any, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.rollNumber).localeCompare(String(b.rollNumber));
      });
    }

    const assignmentsWithDetails = createdAssignments.map(assignment => {
      const assignmentSubmissions = submissionsByAssignment.get(assignment.id) || [];
      
      const submittedStudentIds = new Set(assignmentSubmissions.map(s => s.studentId));
      
      const targetStudents = (studentsByClass.get(assignment.classId) || [])
        .filter(student => !assignment.sectionId || student.sectionId === assignment.sectionId);
      
      const pendingStudents = targetStudents.filter(student => !submittedStudentIds.has(student.id));

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
    const { title, description, dueAt } = body;
    let { sectionId, subjectId, referenceFileKey, referenceFileName } = body;

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
    referenceFileKey = typeof referenceFileKey === "string" ? referenceFileKey.trim() : "";
    referenceFileName = typeof referenceFileName === "string" ? referenceFileName.trim() : "";
    if (referenceFileKey && !referenceFileName) return NextResponse.json({ error: "Reference file name is required" }, { status: 400 });
    if (referenceFileName.length > 255) return NextResponse.json({ error: "Reference file name is too long" }, { status: 400 });

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

    const referenceResource = referenceFileKey ? await verifyCloudinarySubmission(referenceFileKey) : null;

    const [insertedAssignment] = await db.insert(assignments).values({
      institutionId: session.institutionId,
      staffId: session.userId,
      classId: section.classId,
      sectionId,
      subjectId: subjectId || null,
      title: title.trim(),
      description: description ? description.trim() : null,
      referenceFileUrl: referenceResource?.secure_url || null,
      referenceFileName: referenceResource ? referenceFileName : null,
      dueAt: new Date(dueAt),
    }).returning({ id: assignments.id });

    const sectionStudents = await db.select({ id: students.id }).from(students).where(eq(students.sectionId, sectionId));
    const { createBulkNotifications } = await import("@/lib/notifications");
    await createBulkNotifications(sectionStudents.map((s) => ({
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
