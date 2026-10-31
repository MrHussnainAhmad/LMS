import { readUploadBody, uploadScopedContent } from '@/lib/content-upload';
import { withApiPolicy } from "@/lib/api-policy";
import { submitAdmissionFeeProof } from '@/lib/manual-admission-payments';
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  admissionApplicantAccounts,
  admissionApplications,
  admissionCycles,
  admissionFeePayments,
  institutions,
} from "@/db/schema";
import cloudinary from "@/lib/cloudinary";
import {
  encodeAdmissionFileAsset,
  hasExactFolderPrefix,
  parseAdmissionUploadCompletion,
} from "@/lib/admission-files";
import { getAdmissionSessionFromRequest } from "@/lib/admission-auth";
import { parseInstitutionHostname } from "@/lib/institution-domain";
import { getPublicSiteBaseDomain } from "@/lib/public-site-domain";
import { withRateLimit } from "@/lib/rate-limit";
import { getPaymentAccounts } from "@/lib/manual-payment-accounts";
import { readPaymentConfig,PaymentError } from '@/lib/payments/config';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

async function authorize(req: NextRequest, applicationId: number) {
  const session = await getAdmissionSessionFromRequest(req);
  const hostname = parseInstitutionHostname(
    req.headers.get("host") || "",
    await getPublicSiteBaseDomain(),
  );
  if (!session || hostname.kind !== "institution") return null;
  const [row] = await db
    .select({
      payment: admissionFeePayments,
      applicationStatus: admissionApplications.status,
      archivedAt: admissionCycles.archivedAt,
      accountSessionVersion: admissionApplicantAccounts.sessionVersion,
    })
    .from(admissionApplications)
    .innerJoin(admissionCycles, eq(admissionCycles.id, admissionApplications.cycleId))
    .innerJoin(
      admissionFeePayments,
      and(
        eq(admissionFeePayments.applicationId, admissionApplications.id),
        eq(
          admissionFeePayments.institutionId,
          admissionApplications.institutionId,
        ),
      ),
    )
    .innerJoin(
      admissionApplicantAccounts,
      and(
        eq(admissionApplicantAccounts.id, admissionApplications.applicantId),
        eq(
          admissionApplicantAccounts.institutionId,
          admissionApplications.intakeInstitutionId,
        ),
      ),
    )
    .innerJoin(
      institutions,
      eq(institutions.id, admissionApplications.intakeInstitutionId),
    )
    .where(
      and(
        eq(admissionApplications.id, applicationId),
        eq(admissionApplications.applicantId, session.applicantId),
        eq(admissionApplications.intakeInstitutionId, session.institutionId),
        eq(institutions.publicSlug, hostname.slug),
      ),
    )
    .limit(1);
  if (
    !row ||
    row.accountSessionVersion !== session.sessionVersion
  )
    return null;
  return { ...row, session };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  const applicationId = Number((await params).applicationId);
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) return NextResponse.json({ error: "Invalid application." }, { status: 400 });
  const authorized = await authorize(req, applicationId);
  if (!authorized) return NextResponse.json({ error: "Applicant session required." }, { status: 401 });
  return NextResponse.json({ paymentAccounts: await getPaymentAccounts(authorized.payment.institutionId) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export const POST = withApiPolicy(async (
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) => {
  const { applicationId: rawApplicationId } = await params;
  const applicationId = Number(rawApplicationId);
  if (!Number.isInteger(applicationId) || applicationId <= 0)
    return NextResponse.json({ error: "Invalid application" }, { status: 400 });
  const authorized = await authorize(req, applicationId);
  if (!authorized)
    return NextResponse.json(
      { error: "Applicant session required" },
      { status: 401 },
    );
  if((await readPaymentConfig(authorized.payment.institutionId)).mode!=='MANUAL')return NextResponse.json({error:'Manual payments are disabled. Use Online checkout.'},{status:409});
  if (authorized.archivedAt) return NextResponse.json({ error: "Restore this archived admission cycle before changing its records." }, { status: 409 });
  if (
    authorized.applicationStatus !== "FEE_PENDING" ||
    !["PENDING", "REJECTED"].includes(authorized.payment.status)
  ) {
    return NextResponse.json(
      { error: "A fee payment is not currently awaiting submission" },
      { status: 409 },
    );
  }
  const limited = await withRateLimit(
    req,
    "upload",
    `applicant-fee:${authorized.session.applicantId}`,
  );
  if (!limited.success)
    return NextResponse.json(
      { error: "Too many upload attempts. Please wait and try again." },
      { status: 429 },
    );

  const body = await readUploadBody(req);
  if (!body || typeof body !== "object" || !("action" in body))
    return NextResponse.json(
      { error: "Invalid payment action" },
      { status: 400 },
    );

  if (body.action === 'signature') return NextResponse.json({ uploadUrl: req.nextUrl.pathname + req.nextUrl.search }, { headers: { 'Cache-Control': 'no-store' } });
  if (body.action === 'upload') {
    const asset = await uploadScopedContent('file' in body ? body.file : null, { folder: `admission-fees/${authorized.payment.institutionId}/${applicationId}`, privateFile: true, formats: ["jpg","jpeg","png","webp","pdf"] });
    return NextResponse.json(asset, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (
    body.action !== "complete" ||
    !("payerReference" in body) ||
    typeof body.payerReference !== "string" ||
    !("payerSourceBank" in body) ||
    typeof body.payerSourceBank !== "string"
  ) {
    return NextResponse.json(
      { error: "Source bank, payment reference, and proof are required" },
      { status: 400 },
    );
  }
  const payerReference = body.payerReference.trim();
  const payerSourceBank = body.payerSourceBank.trim();
  if (payerReference.length < 2 || payerReference.length > 160)
    return NextResponse.json(
      { error: "Enter a valid transaction or receipt reference" },
      { status: 400 },
    );
  if (payerSourceBank.length < 2 || payerSourceBank.length > 120)
    return NextResponse.json(
      { error: "Enter the bank or wallet used to send payment" },
      { status: 400 },
    );
  const asset = parseAdmissionUploadCompletion(body);
  const expectedFolder = `admission-fees/${authorized.payment.institutionId}/${applicationId}`;
  if (!asset || !hasExactFolderPrefix(asset.publicId, expectedFolder)) {
    return NextResponse.json(
      { error: "Uploaded payment proof could not be verified" },
      { status: 400 },
    );
  }
  try {
    const resource = await cloudinary.api.resource(asset.publicId, {
      resource_type: asset.resourceType,
      type: "authenticated",
    });
    if (
      resource.type !== "authenticated" ||
      resource.format?.toLowerCase() !== asset.format ||
      !ALLOWED_PROOF_FORMATS.has(asset.format) ||
      Number(resource.bytes) > MAX_PROOF_BYTES
    ) {
      await cloudinary.uploader
        .destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: "authenticated",
          invalidate: true,
        })
        .catch(() => undefined);
      return NextResponse.json(
        { error: "Uploaded payment proof could not be verified" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Uploaded payment proof could not be verified" },
      { status: 400 },
    );
  }

  let submitted;
  try { submitted = await db.transaction(tx => submitAdmissionFeeProof(tx, { institutionId: authorized.payment.institutionId, applicationId, paymentId: authorized.payment.id, expectedStatus: authorized.payment.status, paymentAccountId: String("paymentAccountId" in body ? body.paymentAccountId : ""), transactionId: payerReference, sourceBankName: payerSourceBank, proofFileKey: encodeAdmissionFileAsset(asset) })); } catch (error) {
    if(error instanceof PaymentError)return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof Error && error.message === "PAYMENT_ACCOUNT_UNAVAILABLE") return NextResponse.json({ error: "Payment account was removed. Refresh and select a current account." }, { status: 409 });
    if (error instanceof Error && error.message === "PAYMENT_REFERENCE_USED") return NextResponse.json({ error: "This transaction ID has already been submitted for this payment account." }, { status: 409 });
    throw error;
  }
  if (!submitted) return NextResponse.json({ error: "Fee status changed. Refresh before submitting proof." }, { status: 409 });
  return NextResponse.json({ success: true, status: "FEE_VERIFICATION" });
});
