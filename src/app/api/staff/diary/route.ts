import { NextResponse } from "next/server";
import { db } from "@/db";
import { diaries } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const diarySchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    // Only STAFF can access this endpoint
    if (!session || session.role !== "STAFF") {
      return NextResponse.json({ error: "Forbidden: Only staff can view or edit diaries" }, { status: 403 });
    }

    let scopedQuery = db.select().from(diaries).where(eq(diaries.staffId, session.userId));
    const allDiaries = await scopedQuery.orderBy(diaries.date, diaries.createdAt);
    return NextResponse.json(allDiaries);
  } catch (error) {
    console.error("Error fetching diaries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STAFF") {
      return NextResponse.json({ error: "Forbidden: Only staff can create diaries" }, { status: 403 });
    }

    const body = await req.json();
    const result = diarySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.issues }, { status: 400 });
    }

    if (!session.institutionId) {
      return NextResponse.json({ error: "No institution associated with staff" }, { status: 400 });
    }

    const values = {
      institutionId: session.institutionId,
      staffId: session.userId,
      classId: result.data.classId,
      subjectId: result.data.subjectId ?? null,
      date: result.data.date,
      content: result.data.content,
    };

    // General class diary entries have no subject and always create a new row.
    if (values.subjectId === null) {
      const [newDiary] = await db.insert(diaries).values(values).returning();
      return NextResponse.json(newDiary);
    }

    // Subject-specific entries update the existing entry for the same class and date.
    const [newDiary] = await db.insert(diaries).values(values).onConflictDoUpdate({
      target: [diaries.classId, diaries.subjectId, diaries.date],
      targetWhere: sql`${diaries.subjectId} is not null`,
      set: { content: result.data.content },
    }).returning();

    return NextResponse.json(newDiary);
  } catch (error) {
    console.error("Error creating diary:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
