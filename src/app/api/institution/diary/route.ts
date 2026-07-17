import { NextResponse } from "next/server";
import { db } from "@/db";
import { diaries, subjects, staff } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    // Only INSTITUTION_ADMIN and related roles can access this endpoint
    if (!session || !['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden: Not an institution admin" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classIdStr = searchParams.get("classId");
    const dateStr = searchParams.get("date");

    if (!classIdStr || !dateStr) {
      return NextResponse.json({ error: "classId and date are required" }, { status: 400 });
    }

    const classId = parseInt(classIdStr);

    const entries = await db.select({
      id: diaries.id,
      content: diaries.content,
      date: diaries.date,
      subjectName: subjects.name,
      staffName: staff.name,
    })
    .from(diaries)
    .leftJoin(subjects, eq(diaries.subjectId, subjects.id))
    .leftJoin(staff, eq(diaries.staffId, staff.id))
    .where(and(
      eq(diaries.institutionId, session.institutionId!),
      eq(diaries.classId, classId),
      eq(diaries.date, dateStr)
    ));

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching institution diaries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
