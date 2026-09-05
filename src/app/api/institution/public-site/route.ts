import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { institutionPublicProfiles, institutions, systemSettings } from '@/db/schema';
import { logAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';
import { invalidateInstitutionTenantCache } from '@/lib/institution-tenant';
import { institutionPublicUrl } from '@/lib/institution-domain';
import { getTenantContext, requireRole } from '@/lib/rbac';
import { institutionPublicProfileSchema } from '@/lib/validators/institution-public-profile';

export const GET = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);
  const [[institution], [profile], [platformSettings]] = await Promise.all([
    db.select({
      name: institutions.name,
      publicSlug: institutions.publicSlug,
      publicSiteEnabled: institutions.publicSiteEnabled,
    }).from(institutions).where(eq(institutions.id, institutionId)).limit(1),
    db.select().from(institutionPublicProfiles).where(eq(institutionPublicProfiles.institutionId, institutionId)).limit(1),
    db.select({ publicSiteBaseDomain: systemSettings.publicSiteBaseDomain }).from(systemSettings).limit(1),
  ]);

  if (!institution) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
  const requestHost = req.headers.get('host') || '';
  const requestProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.nextUrl.protocol;
  return NextResponse.json({
    institution,
    profile: profile || null,
    publicUrl: institution.publicSlug ? institutionPublicUrl(institution.publicSlug, requestHost, requestProtocol, platformSettings?.publicSiteBaseDomain) : null,
    qrUrl: institution.publicSlug ? institutionPublicUrl(institution.publicSlug, undefined, 'https:', platformSettings?.publicSiteBaseDomain) : null,
  });
});

export const PATCH = requireRole(['INSTITUTION'], async (req: NextRequest, { session }) => {
  const institutionId = getTenantContext(session);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = institutionPublicProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid website information' }, { status: 400 });
  }

  const [institution] = await db.select({
    publicSlug: institutions.publicSlug,
    status: institutions.status,
  }).from(institutions).where(eq(institutions.id, institutionId)).limit(1);

  if (!institution || institution.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Only approved institutions can edit a public website' }, { status: 409 });
  }
  if (!institution.publicSlug) {
    return NextResponse.json({ error: 'A platform administrator must assign your subdomain first' }, { status: 409 });
  }

  await db.insert(institutionPublicProfiles).values({
    institutionId,
    ...parsed.data,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: institutionPublicProfiles.institutionId,
    set: {
      ...parsed.data,
      updatedAt: new Date(),
    },
  });

  await invalidateInstitutionTenantCache(institution.publicSlug);
  await logAudit({
    institutionId,
    actorId: session.userId,
    actorRole: session.role,
    action: 'UPDATE_INSTITUTION_PUBLIC_PROFILE',
    target: `Institution ${institutionId} public website`,
    ip: getClientIp(req),
  });

  return NextResponse.json({ success: true, profile: parsed.data });
});
