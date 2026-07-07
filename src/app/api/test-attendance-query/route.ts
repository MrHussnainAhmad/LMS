import { NextResponse } from "next/server";
import { db } from "@/db";
import { sections, classes, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const staffId = parseInt(url.searchParams.get("staffId") || "1");
  const institutionId = parseInt(url.searchParams.get("institutionId") || "1");

  const assignments = await db.selectDistinct({
    id: sections.id,
    name: sections.name,
    classId: sections.classId,
    className: classes.name,
  })
    .from(sections)
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(and(eq(sections.classTeacherId, staffId), eq(sections.institutionId, institutionId)));

  const allSections = await db.select().from(sections);
  const allStaff = await db.select().from(staff);

  return NextResponse.json({
    staffId,
    institutionId,
    assignments,
    allSections,
    allStaff
  });
}
