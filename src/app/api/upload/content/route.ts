import { NextResponse } from 'next/server';
import { readUploadBody, uploadScopedContent } from '@/lib/content-upload';
import { requireRole } from '@/lib/rbac';
import { withRateLimit } from '@/lib/rate-limit';
import { ownedUploadFolder } from '@/lib/upload-ownership';
import { isMainCampusWebsite } from '@/lib/public-website-access';

export const POST = requireRole(['STUDENT', 'STAFF', 'INSTITUTION', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'], async (req, { session }) => {
  const body = await readUploadBody(req);
  const purpose = body?.purpose || 'image';
  if (typeof purpose !== 'string' || !['image', 'document', 'public-site-image'].includes(purpose)) return NextResponse.json({ error: 'Invalid upload purpose' }, { status: 400 });
  let folder = ownedUploadFolder(session);
  if (purpose === 'public-site-image') {
    if (!['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role) || !session.institutionId || !await isMainCampusWebsite(session.institutionId)) return NextResponse.json({ error: 'Public website images are available only to main-campus administrators' }, { status: 403 });
    folder = 'institution-public/' + session.institutionId;
  }
  const identity = session.role + ':' + session.userId;
  if (!(await withRateLimit(req, 'upload', identity)).success) return NextResponse.json({ error: 'Too many uploads. Please try again shortly.' }, { status: 429 });
  const asset = await uploadScopedContent(body?.file, { folder, identity, privateFile: purpose === 'document', documents: purpose === 'document' });
  return NextResponse.json(asset, { headers: { 'Cache-Control': 'no-store' } });
});
