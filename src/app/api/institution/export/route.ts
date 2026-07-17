import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { students, staff, classes, sections } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";
import AdmZip from "adm-zip";

export const GET = requireRole(["INSTITUTION"], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);

  try {
    // Filter out soft-deleted records and cap at 5000 rows per table for memory safety
    const allStudents = await db.select().from(students).where(and(eq(students.institutionId, tenantId), isNull(students.deletedAt))).limit(5000);
    const allStaff = await db.select().from(staff).where(and(eq(staff.institutionId, tenantId), isNull(staff.deletedAt))).limit(5000);
    const allClasses = await db.select().from(classes).where(and(eq(classes.institutionId, tenantId), isNull(classes.deletedAt))).limit(5000);
    const allSections = await db.select().from(sections).where(and(eq(sections.institutionId, tenantId), isNull(sections.deletedAt))).limit(5000);

    const zip = new AdmZip();

    // Helper to convert array of objects to CSV string
    const toCsv = (arr: any[]) => {
      if (arr.length === 0) return "";
      const headers = Object.keys(arr[0]).join(",");
      const rows = arr.map(obj => 
        Object.values(obj).map(val => {
          if (val === null || val === undefined) return "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(",")
      ).join("\n");
      return headers + "\n" + rows;
    };

    zip.addFile("students.csv", Buffer.from(toCsv(allStudents), "utf8"));
    zip.addFile("staff.csv", Buffer.from(toCsv(allStaff), "utf8"));
    zip.addFile("classes.csv", Buffer.from(toCsv(allClasses), "utf8"));
    zip.addFile("sections.csv", Buffer.from(toCsv(allSections), "utf8"));

    const zipBuffer = zip.toBuffer();

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="institution_data_export.zip"`,
      },
    });
  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
