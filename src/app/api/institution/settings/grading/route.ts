import { readBoundedJson } from '@/lib/http';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { gradingScales } from '@/db/schema';
import { getTenantContext, requireRole } from '@/lib/rbac';

import { parseScale } from '@/lib/batch-exams';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (_req, { session }) => {
  const [scale] = await db.select().from(gradingScales).where(eq(gradingScales.institutionId, getTenantContext(session))).limit(1);
  return NextResponse.json({ scale: scale || null });
});

async function save(req: NextRequest, session: Parameters<typeof getTenantContext>[0]) {
  const scale = parseScale(await readBoundedJson(req));
  if (!scale) return NextResponse.json({ error: 'Provide distinct whole-number grade ranges covering 0?100 with no gaps or overlaps. Grade bands use rounded percentages; pass decisions use the exact percentage.' }, { status: 400 });
  const institutionId = getTenantContext(session);
  const [saved] = await db.insert(gradingScales).values({ institutionId, ...scale }).onConflictDoUpdate({
    target: gradingScales.institutionId,
    set: { ...scale },
  }).returning();
  return NextResponse.json({ scale: saved });
}

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req, { session }) => save(req, session));
export const PUT = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req, { session }) => save(req, session));
