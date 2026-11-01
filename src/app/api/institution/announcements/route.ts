import { readBoundedJson } from '@/lib/http';
import { inputErrorResponse } from '@/lib/input-error-response';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireRole, getTenantContext } from "@/lib/rbac";


import { announcementResponsePolicySchema, getAnnouncementReceipts, deleteInstitutionAnnouncement } from '@/lib/announcements';

export const GET = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const id=Number(req.nextUrl.searchParams.get('id'));
  if(id>0&&Number.isSafeInteger(id))return NextResponse.json(await getAnnouncementReceipts(session,id),{headers:{'Cache-Control':'private, no-store'}});

  const rows = await db.select().from(announcements)
    .where(eq(announcements.institutionId, institutionId))
    .orderBy(desc(announcements.createdAt));

  return NextResponse.json({ announcements: rows });
});

export const POST = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  
  try {
    const body = await readBoundedJson(req);
    const { title, content, targetType, targetCampusId, targetClassId, targetSectionId, targetUserRole } = body;
    const responsePolicy=announcementResponsePolicySchema.parse(body.responsePolicy??{});

    if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });

    if(responsePolicy.mode==='CONSENT'&&targetUserRole==='STAFF') return NextResponse.json({error:'Consent notices must target students and parents.'},{status:400});

    const [inserted] = await db.insert(announcements).values({
      institutionId,
      senderRole: "INSTITUTION",
      senderId: institutionId,
      title,
      content,
      responsePolicy,
      targetType: targetType || "ALL",
      targetCampusId: targetCampusId ? Number(targetCampusId) : null,
      targetClassId: targetClassId ? Number(targetClassId) : null,
      targetSectionId: targetSectionId ? Number(targetSectionId) : null,
      targetUserRole: targetUserRole || null,
    }).returning({ id: announcements.id });

    // Try to send notifications using the lib if available
    try {
      const { processAnnouncementNotification } = await import("@/lib/notifications");
      await processAnnouncementNotification(inserted.id);
    } catch (e) {
      console.error("Failed to send notifications for announcement", e);
    }

    return NextResponse.json({ success: true, announcement: inserted });
  } catch (error: any) {
    const publicInputError = inputErrorResponse(error);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    return NextResponse.json({ error: error.message || "Failed to create announcement" }, { status: 500 });
  }
});

export const DELETE = requireRole(["INSTITUTION", "INSTITUTION_ADMIN"], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));

  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await deleteInstitutionAnnouncement({...session,institutionId},id);
  return NextResponse.json({ success: true });
});
