import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tests, classes, sections, subjects, staffAssignments, students, marks } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, inArray } from "drizzle-orm";
import { redis, getCachedOrFetch, getRawCachedOrFetch } from "@/lib/redis";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const instId = session.institutionId!;
    const staffId = session.userId;
    const cacheKey = `cache:staff:marks:${instId}:${staffId}`;
    const cachedData = await getRawCachedOrFetch(cacheKey, 60, async () => {
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
        .where(and(eq(staffAssignments.staffId, staffId), eq(staffAssignments.institutionId, instId)));

      const sectionOptionsMap = new Map();
      const subjectOptionsMap = new Map();
      const classIds = new Set<number>();
      const subjectIds = new Set<number>();

      assignedSlotsRaw.forEach(slot => {
        classIds.add(slot.classId);
        if (slot.subjectId) subjectIds.add(slot.subjectId);

        if (!sectionOptionsMap.has(slot.sectionId)) {
          sectionOptionsMap.set(slot.sectionId, {
            id: slot.sectionId,
            className: slot.className,
            name: slot.sectionName,
            classId: slot.classId,
          });
        }

        if (slot.subjectId && slot.subjectName) {
          if (!subjectOptionsMap.has(slot.subjectId)) {
            subjectOptionsMap.set(slot.subjectId, {
              id: slot.subjectId,
              name: slot.subjectName,
              sectionId: slot.sectionId,
            });
          }
        }
      });

      const allInstitutionTests = await db.select({
        id: tests.id,
        title: tests.title,
        type: tests.type,
        maxMarks: tests.maxMarks,
        date: tests.date,
        createdByRole: tests.createdByRole,
        staffId: tests.staffId,
        classId: tests.classId,
        sectionId: tests.sectionId,
        subjectId: tests.subjectId,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
      })
        .from(tests)
        .innerJoin(classes, eq(tests.classId, classes.id))
        .leftJoin(sections, eq(tests.sectionId, sections.id))
        .leftJoin(subjects, eq(tests.subjectId, subjects.id))
        .where(eq(tests.institutionId, instId));

      const eligibleTests = allInstitutionTests.filter((test) => {
        if (test.createdByRole === "STAFF") return test.staffId === staffId;
        return classIds.has(test.classId) && test.subjectId && subjectIds.has(test.subjectId);
      });

      // Fetch marks and students for the eligible tests
      const eligibleTestIds = eligibleTests.map(t => t.id);
      const markRows = eligibleTestIds.length > 0 ? await db.select({
        testId: marks.testId,
        studentId: marks.studentId,
        marksObtained: marks.marksObtained,
      }).from(marks).where(
        and(
          eq(marks.institutionId, instId),
          inArray(marks.testId, eligibleTestIds)
        )
      ) : [];

      const marksByTestAndStudent = new Map<string, number>();
      const totalMarksUploaded = new Map<number, number>();
      
      for (const row of markRows) {
        const key = `${row.testId}:${row.studentId}`;
        marksByTestAndStudent.set(key, row.marksObtained);
        totalMarksUploaded.set(row.testId, (totalMarksUploaded.get(row.testId) || 0) + 1);
      }

      const classStudents = await getCachedOrFetch(`cache:rosters:${instId}`, 60, () =>
        db.select({
          id: students.id,
          name: students.name,
          classId: students.classId,
          sectionId: students.sectionId,
          classRollNumber: students.classRollNumber,
        }).from(students).where(eq(students.institutionId, instId))
      );

      const studentsByClass = new Map<number, typeof classStudents>();
      for (const student of classStudents) {
        const existing = studentsByClass.get(student.classId) || [];
        existing.push(student);
        studentsByClass.set(student.classId, existing);
      }

      for (const list of studentsByClass.values()) {
        // Fast numeric sort outside the loop
        list.sort((a, b) => {
          const numA = parseInt(a.classRollNumber, 10);
          const numB = parseInt(b.classRollNumber, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.classRollNumber.localeCompare(b.classRollNumber);
        });
      }

      const testsList = eligibleTests.map(test => {
        return {
          ...test,
          uploadedCount: totalMarksUploaded.get(test.id) || 0,
        };
      });

      // Prepare normalized rosters
      const rostersObj: Record<string, any[]> = {};
      for (const [classId, roster] of studentsByClass.entries()) {
        rostersObj[classId] = roster.map(s => {
          // Marks are not attached to the roster array here because they are per-test.
          // Wait, if we separate them, how does the client get marks?
          // We can send marks as a separate dictionary!
          return { id: s.id, name: s.name, rollNumber: s.classRollNumber };
        });
      }

      const marksObj = Object.fromEntries(marksByTestAndStudent);

      return JSON.stringify({
        tests: testsList,
        rosters: rostersObj,
        marks: marksObj,
        sectionOptions: Array.from(sectionOptionsMap.values()),
        subjectOptions: Array.from(subjectOptionsMap.values()),
      });
    });

    return new NextResponse(cachedData as string, { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    console.error("Error fetching marks data:", error);
    return NextResponse.json({ error: "Failed to fetch marks data" }, { status: 500 });
  }
});

export const POST = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { sectionId, type, title, maxMarks, date, subjectIds } = body;

    const parsedSectionId = Number(sectionId);
    if (!Number.isInteger(parsedSectionId) || parsedSectionId <= 0) {
      return NextResponse.json({ error: "Section is required" }, { status: 400 });
    }

    if (!["DAILY", "WEEKLY", "QUIZ"].includes(type)) {
      return NextResponse.json({ error: "Staff can only create Daily, Weekly, or Quiz assessments" }, { status: 400 });
    }

    const parsedMaxMarks = Number(maxMarks);
    if (!Number.isFinite(parsedMaxMarks) || parsedMaxMarks <= 0) {
      return NextResponse.json({ error: "Max marks must be greater than 0" }, { status: 400 });
    }

    if (!title || typeof title !== "string") return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!date || typeof date !== "string") return NextResponse.json({ error: "Date is required" }, { status: 400 });

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ error: "At least one subject is required" }, { status: 400 });
    }

    // Verify staff has access to this section
    const [section] = await db.select().from(sections).where(and(eq(sections.id, parsedSectionId), eq(sections.institutionId, session.institutionId))).limit(1);
    
    if (!section) return NextResponse.json({ error: "Invalid class section" }, { status: 400 });

    const uniqueSubjectIds = Array.from(new Set(subjectIds.map(Number)));

    const assignments = await db.select({ subjectId: staffAssignments.subjectId }).from(staffAssignments).where(and(
      eq(staffAssignments.staffId, session.userId),
      eq(staffAssignments.institutionId, session.institutionId),
      eq(staffAssignments.sectionId, parsedSectionId),
      inArray(staffAssignments.subjectId, uniqueSubjectIds)
    ));

    if (assignments.length !== uniqueSubjectIds.length) {
      return NextResponse.json({ error: "One or more subjects are not assigned to you for this class" }, { status: 403 });
    }

    const newTests = uniqueSubjectIds.map(subjectId => ({
      institutionId: session.institutionId!,
      classId: section.classId,
      sectionId: parsedSectionId,
      subjectId,
      staffId: session.userId,
      createdByRole: "STAFF" as const,
      type: type as "DAILY" | "WEEKLY" | "QUIZ",
      title: title.trim(),
      maxMarks: parsedMaxMarks,
      date,
    }));

    await db.insert(tests).values(newTests);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating assessment:", error);
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 });
  }
});
