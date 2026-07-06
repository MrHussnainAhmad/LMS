import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { eq } from "drizzle-orm";

export const PATCH = requireRole(["INSTITUTION"], async (req: NextRequest, { session }) => {
  const body = await req.json();
  const logoKey = typeof body.logoKey === "string" ? body.logoKey.trim() : "";

  if (!logoKey || logoKey.length < 5) {
    return NextResponse.json({ error: "Uploaded logo is required" }, { status: 400 });
  }

  await db.update(institutions)
    .set({ logoKey })
    .where(eq(institutions.id, session.userId));

  return NextResponse.json({ message: "Institution logo updated" });
});
