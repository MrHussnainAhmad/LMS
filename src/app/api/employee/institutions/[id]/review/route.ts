import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { institutions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/rbac';
import { reviewInstitutionSchema } from '@/lib/validators/institution';
import { sendEmail, InstitutionStatusEmail } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { invalidateUserValidity } from '@/lib/user';

export const POST = requireRole(['SUPER_ADMIN', 'EMPLOYEE'], async (req: NextRequest, { params, session }) => {
  const institutionId = parseInt(params.id, 10);
  if (isNaN(institutionId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = reviewInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { status, rejectionReason } = parsed.data;

  const [inst] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!inst) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
  }

  await db.update(institutions)
    .set({ status, rejectionReason: status === 'REJECTED' ? rejectionReason : null })
    .where(eq(institutions.id, institutionId));
  await invalidateUserValidity('INSTITUTION', institutionId);

  await logAudit({
    actorId: session.userId,
    actorRole: session.role,
    action: `REVIEW_INSTITUTION_${status}`,
    target: `Institution ${institutionId}`,
    ip: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
  });

  await sendEmail({
    to: inst.contactEmail,
    subject: `Institution Registration ${status}`,
    html: InstitutionStatusEmail({ name: inst.name, status, reason: rejectionReason }),
  });

  return NextResponse.json({ message: `Institution ${status}` });
});
