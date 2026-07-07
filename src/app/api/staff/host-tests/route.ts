import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { 
  tests, classes, sections, subjects, onlineTests, staffAssignments, 
  onlineTestSubmissions, onlineTestQuestions, students, announcements
} from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq, and, desc, inArray } from "drizzle-orm";

export const GET = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const assignedSlotsRaw = await db.select({
      sectionId: sections.id,
      sectionName: sections.name,
      className: classes.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .innerJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .where(and(eq(staffAssignments.staffId, session.userId), eq(staffAssignments.institutionId, session.institutionId)));

    const sectionOptionsMap = new Map();
    assignedSlotsRaw.forEach(slot => {
      if (!sectionOptionsMap.has(slot.sectionId)) {
        sectionOptionsMap.set(slot.sectionId, {
          id: slot.sectionId,
          className: slot.className,
          name: slot.sectionName,
        });
      }
    });

    const hostedTests = await db.select({
      testId: tests.id,
      title: tests.title,
      type: tests.type,
      maxMarks: tests.maxMarks,
      date: tests.date,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
      onlineTestId: onlineTests.id,
      durationMinutes: onlineTests.durationMinutes,
      mode: onlineTests.mode,
    })
      .from(onlineTests)
      .innerJoin(tests, eq(onlineTests.testId, tests.id))
      .innerJoin(classes, eq(tests.classId, classes.id))
      .leftJoin(sections, eq(tests.sectionId, sections.id))
      .leftJoin(subjects, eq(tests.subjectId, subjects.id))
      .where(and(eq(tests.staffId, session.userId), eq(tests.institutionId, session.institutionId)))
      .orderBy(desc(onlineTests.createdAt));

    const onlineTestIds = hostedTests.map(t => t.onlineTestId);
    
    let submissions: any[] = [];
    let questions: any[] = [];
    
    if (onlineTestIds.length > 0) {
      submissions = await db.select({
        id: onlineTestSubmissions.id,
        onlineTestId: onlineTestSubmissions.onlineTestId,
        studentName: students.name,
        rollNumber: students.classRollNumber,
        status: onlineTestSubmissions.status,
        violationReason: onlineTestSubmissions.violationReason,
        totalScore: onlineTestSubmissions.totalScore,
        answers: onlineTestSubmissions.answers,
      })
        .from(onlineTestSubmissions)
        .innerJoin(students, eq(onlineTestSubmissions.studentId, students.id))
        .where(and(
          eq(onlineTestSubmissions.institutionId, session.institutionId),
          inArray(onlineTestSubmissions.onlineTestId, onlineTestIds)
        ))
        .orderBy(desc(onlineTestSubmissions.submittedAt));
        
      questions = await db.select({
        id: onlineTestQuestions.id,
        onlineTestId: onlineTestQuestions.onlineTestId,
        questionType: onlineTestQuestions.questionType,
        prompt: onlineTestQuestions.prompt,
        marks: onlineTestQuestions.marks,
        orderIndex: onlineTestQuestions.orderIndex,
      }).from(onlineTestQuestions)
        .where(inArray(onlineTestQuestions.onlineTestId, onlineTestIds));
    }

    const enhancedTests = hostedTests.map(test => {
      const testSubmissions = submissions.filter(s => s.onlineTestId === test.onlineTestId);
      const testQuestions = questions
        .filter(q => q.onlineTestId === test.onlineTestId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
        
      return {
        ...test,
        id: test.testId, // Provide 'id' for compatibility
        submissions: testSubmissions,
        questions: testQuestions
      };
    });

    return NextResponse.json({ 
      tests: enhancedTests,
      assignedSlots: Array.from(sectionOptionsMap.values()),
      subjectOptions: assignedSlotsRaw.map(slot => ({
        id: slot.subjectId, name: slot.subjectName, sectionId: slot.sectionId
      }))
    });
  } catch (error) {
    console.error("Error fetching hosted tests:", error);
    return NextResponse.json({ error: "Failed to fetch tests" }, { status: 500 });
  }
});

export const POST = requireRole(["STAFF"], async (req: NextRequest, { session }) => {
  if (!session.institutionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { sectionId, subjectId, title, mode, durationMinutes, mcqs, shortQuestions } = body;

    if (!title) return NextResponse.json({ error: "Test title is required" }, { status: 400 });
    if (mode !== "MCQ" && mode !== "MIX") return NextResponse.json({ error: "Invalid test mode" }, { status: 400 });
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return NextResponse.json({ error: "Duration is required" }, { status: 400 });

    const [assignment] = await db.select({
      classId: sections.classId,
      sectionName: sections.name,
      className: classes.name,
      subjectName: subjects.name,
    })
      .from(staffAssignments)
      .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
      .innerJoin(classes, eq(sections.classId, classes.id))
      .innerJoin(subjects, eq(staffAssignments.subjectId, subjects.id))
      .where(and(
        eq(staffAssignments.staffId, session.userId),
        eq(staffAssignments.institutionId, session.institutionId),
        eq(staffAssignments.sectionId, sectionId),
        eq(staffAssignments.subjectId, subjectId)
      ))
      .limit(1);

    if (!assignment) return NextResponse.json({ error: "This class section and subject are not assigned to you" }, { status: 403 });

    if (!mcqs || mcqs.length === 0) return NextResponse.json({ error: "Add at least one MCQ" }, { status: 400 });
    if (mode === "MIX" && (!shortQuestions || shortQuestions.length === 0)) return NextResponse.json({ error: "Mix tests need at least one short question" }, { status: 400 });

    const totalMarks = (mcqs || []).reduce((sum: number, q: any) => sum + Number(q.marks), 0) + 
                       (shortQuestions || []).reduce((sum: number, q: any) => sum + Number(q.marks), 0);
                       
    const today = new Date().toISOString().slice(0, 10);
    
    const [test] = await db.insert(tests).values({
      institutionId: session.institutionId,
      classId: assignment.classId,
      sectionId,
      subjectId,
      staffId: session.userId,
      createdByRole: "STAFF",
      type: "QUIZ",
      title: title.trim(),
      maxMarks: totalMarks,
      date: today,
    }).returning();

    const [onlineTest] = await db.insert(onlineTests).values({
      institutionId: session.institutionId,
      testId: test.id,
      mode: mode as "MCQ" | "MIX",
      durationMinutes: Number(durationMinutes),
    }).returning();

    let orderIndex = 0;
    
    for (const q of mcqs) {
      await db.insert(onlineTestQuestions).values({
        onlineTestId: onlineTest.id,
        questionType: "MCQ",
        prompt: q.prompt,
        options: q.options,
        correctOptionIndex: Number(q.correctOptionIndex),
        marks: Number(q.marks),
        orderIndex: orderIndex++,
      });
    }

    if (mode === "MIX") {
      for (const q of shortQuestions) {
        await db.insert(onlineTestQuestions).values({
          onlineTestId: onlineTest.id,
          questionType: "SHORT",
          prompt: q.prompt,
          marks: Number(q.marks),
          orderIndex: orderIndex++,
        });
      }
    }

    await db.insert(announcements).values({
      institutionId: session.institutionId,
      senderRole: "STAFF",
      senderId: session.userId,
      targetType: "SECTION",
      targetSectionId: sectionId,
      title: `Online test hosted: ${title}`,
      content: `${title} is now available for ${assignment.className} - ${assignment.sectionName} in ${assignment.subjectName}. Timer: ${durationMinutes} minutes. Do not change tabs after starting the test.`,
    });

    return NextResponse.json({ success: true, testId: test.id });
  } catch (error) {
    console.error("Error creating online test:", error);
    return NextResponse.json({ error: "Failed to create online test" }, { status: 500 });
  }
});
