import { readBoundedJson } from '@/lib/http';
import { positiveInteger } from '@/lib/pagination';
import { NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { announcements, classes, sections, staffAssignments } from '@/db/schema';
import { requireRole } from '@/lib/rbac';
import { inputErrorResponse } from '@/lib/input-error-response';
import { createStaffAnnouncementAction } from '@/app/actions/staff-actions';

export const GET = requireRole(['STAFF'], async (req, { session }) => {
  const options = await db
    .selectDistinct({ id: sections.id, name: sections.name, classId: classes.id, className: classes.name })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(
      and(
        eq(staffAssignments.staffId, session.userId),
        eq(staffAssignments.institutionId, session.institutionId!),
      ),
    );
  const page = positiveInteger(req.nextUrl.searchParams.get('page'));
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.institutionId, session.institutionId!),
        eq(announcements.senderRole, 'STAFF'),
        eq(announcements.senderId, session.userId),
      ),
    )
    .orderBy(desc(announcements.id))
    .limit(11)
    .offset((page - 1) * 10);
  return NextResponse.json({ sections: options, sent: rows.slice(0, 10), hasMore: rows.length > 10, page });
});
export const POST = requireRole(['STAFF'], async (req) => {
  try {
    const body = await readBoundedJson(req);
    if (
      !body ||
      typeof body.title !== 'string' ||
      typeof body.content !== 'string' ||
      !body.title.trim() ||
      !body.content.trim() ||
      body.title.length > 250 ||
      body.content.length > 20000
    )
      return NextResponse.json(
        { error: 'Enter a title and message (maximum 250 / 20000 characters).' },
        { status: 400 },
      );
    const form = new FormData();
    for (const key of ['title', 'content', 'targetType', 'targetClassId', 'targetSectionId'])
      if (body[key] !== undefined) form.set(key, String(body[key]));
    await createStaffAnnouncementAction(form);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const result = inputErrorResponse(error);
    if (result) return NextResponse.json(result.body, { status: result.status });
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    throw error;
  }
});
