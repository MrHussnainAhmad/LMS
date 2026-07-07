import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth";
import { eq } from "drizzle-orm";

function dashboardHref(role: string) {
  if (role === "SUPER_ADMIN") return "/sa/dashboard";
  if (role === "EMPLOYEE") return "/employee/dashboard";
  if (role === "INSTITUTION") return "/institution/dashboard";
  if (role === "STAFF") return "/staff/dashboard";
  if (role === "STUDENT") return "/student/dashboard";
  return "/";
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({
      name: "LMS Platform",
      logoKey: null,
      href: "/",
      isInstitutionBrand: false,
    });
  }

  const institutionId = session.role === "INSTITUTION" ? session.userId : session.institutionId;
  if (!institutionId) {
    return NextResponse.json({
      name: "LMS Platform",
      logoKey: null,
      href: dashboardHref(session.role),
      isInstitutionBrand: false,
    });
  }

  const [institution] = await db.select({
    name: institutions.name,
    logoKey: institutions.logoKey,
  })
    .from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  return NextResponse.json({
    name: institution?.name || "LMS Platform",
    logoKey: institution?.logoKey || null,
    href: dashboardHref(session.role),
    isInstitutionBrand: Boolean(institution),
    role: session.role,
  });
}
