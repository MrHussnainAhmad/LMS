import { readUploadBody, uploadScopedContent } from '@/lib/content-upload';
import { withApiPolicy } from "@/lib/api-policy";
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { admissionApplicantAccounts, admissionApplications, admissionCycles, admissionDocumentRequests, institutions } from '@/db/schema';
import cloudinary from '@/lib/cloudinary';
import { encodeAdmissionFileAsset, hasExactFolderPrefix, parseAdmissionUploadCompletion } from '@/lib/admission-files';
import { getAdmissionSessionFromRequest } from '@/lib/admission-auth';
import { parseInstitutionHostname } from '@/lib/institution-domain';
import { getPublicSiteBaseDomain } from '@/lib/public-site-domain';
import { withRateLimit } from '@/lib/rate-limit';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'txt']);

async function getAuthorizedDocument(req: NextRequest, documentId: number) {
  const session = await getAdmissionSessionFromRequest(req);
  const hostname = parseInstitutionHostname(req.headers.get('host') || '', await getPublicSiteBaseDomain());
  if (!session || hostname.kind !== 'institution') return null;

  const [row] = await db.select({
    document: admissionDocumentRequests,
    archivedAt: admissionCycles.archivedAt,
    accountSessionVersion: admissionApplicantAccounts.sessionVersion,
  }).from(admissionDocumentRequests)
    .innerJoin(admissionApplications, and(
      eq(admissionApplications.id, admissionDocumentRequests.applicationId),
      eq(admissionApplications.institutionId, admissionDocumentRequests.institutionId),
    ))
    .innerJoin(admissionCycles, eq(admissionCycles.id, admissionApplications.cycleId))
    .innerJoin(admissionApplicantAccounts, and(
      eq(admissionApplicantAccounts.id, admissionApplications.applicantId),
      eq(admissionApplicantAccounts.institutionId, admissionApplications.intakeInstitutionId),
    ))
    .innerJoin(institutions, eq(institutions.id, admissionApplications.intakeInstitutionId))
    .where(and(
      eq(admissionDocumentRequests.id, documentId),
      eq(admissionApplications.applicantId, session.applicantId),
      eq(admissionApplications.intakeInstitutionId, session.institutionId),
      eq(institutions.publicSlug, hostname.slug),
    )).limit(1);

  if (!row || row.accountSessionVersion !== session.sessionVersion) return null;
  return { ...row, session };
}

export const POST = withApiPolicy(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ error: 'Invalid document request' }, { status: 400 });
  const authorized = await getAuthorizedDocument(req, documentId);
  if (!authorized) return NextResponse.json({ error: 'Applicant session required' }, { status: 401 });
  if (authorized.archivedAt) return NextResponse.json({ error: 'Restore this archived admission cycle before changing its records.' }, { status: 409 });
  if (!['REQUESTED', 'REJECTED'].includes(authorized.document.status)) {
    return NextResponse.json({ error: 'This document has already been submitted for review' }, { status: 409 });
  }

  const limited = await withRateLimit(req, 'upload', `applicant:${authorized.session.applicantId}`);
  if (!limited.success) return NextResponse.json({ error: 'Too many upload attempts. Please wait and try again.' }, { status: 429 });

  const body = await readUploadBody(req);
  if (!body || typeof body !== 'object' || !('action' in body)) return NextResponse.json({ error: 'Invalid upload action' }, { status: 400 });

  if (body.action === 'signature') return NextResponse.json({ uploadUrl: req.nextUrl.pathname + req.nextUrl.search }, { headers: { 'Cache-Control': 'no-store' } });
  if (body.action === 'upload') {
    const asset = await uploadScopedContent('file' in body ? body.file : null, { folder: `admission-documents/${authorized.document.institutionId}/${authorized.document.applicationId}/${authorized.document.id}`, privateFile: true, documents: true });
    return NextResponse.json(asset, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action !== 'complete') {
    return NextResponse.json({ error: 'Invalid upload completion' }, { status: 400 });
  }
  const asset = parseAdmissionUploadCompletion(body);
  const expectedFolder = `admission-documents/${authorized.document.institutionId}/${authorized.document.applicationId}/${authorized.document.id}`;
  if (!asset || !hasExactFolderPrefix(asset.publicId, expectedFolder)) {
    return NextResponse.json({ error: 'Uploaded file could not be verified' }, { status: 400 });
  }
  try {
    const resource = await cloudinary.api.resource(asset.publicId, { resource_type: asset.resourceType, type: 'authenticated' });
    const format = String(resource.format || (asset.resourceType === 'raw' ? asset.publicId.split('.').pop() : '')).toLowerCase();
    if (resource.type !== 'authenticated' || format !== asset.format || !ALLOWED_DOCUMENT_FORMATS.has(asset.format) || !Number.isFinite(Number(resource.bytes)) || Number(resource.bytes) <= 0 || Number(resource.bytes) > MAX_DOCUMENT_BYTES) {
      await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType, type: 'authenticated', invalidate: true }).catch(() => undefined);
      return NextResponse.json({ error: 'Uploaded file could not be verified' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Uploaded file could not be verified' }, { status: 400 });
  }

  await db.update(admissionDocumentRequests).set({ submittedFileKey: encodeAdmissionFileAsset(asset), status: 'SUBMITTED', reviewerNote: null, updatedAt: new Date() }).where(and(
    eq(admissionDocumentRequests.id, documentId),
    eq(admissionDocumentRequests.institutionId, authorized.document.institutionId),
    eq(admissionDocumentRequests.applicationId, authorized.document.applicationId),
  ));
  return NextResponse.json({ success: true, status: 'SUBMITTED' });
});
