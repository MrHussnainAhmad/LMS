import { and, eq, isNull } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { feeInvoices, admissionApplications, admissionApplicantAccounts, institutions } from '@/db/schema';
import type { JWTPayload } from '@/lib/auth-types';
import { getParentPortalContext } from '@/lib/parent-access';
import { getAdmissionSessionFromRequest } from '@/lib/admission-auth';
import { parseInstitutionHostname } from '@/lib/institution-domain';
import { getPublicSiteBaseDomain } from '@/lib/public-site-domain';
import { PaymentError } from './config';
import type { PaymentTarget } from './service';

export function positiveId(value:unknown){const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw new PaymentError('Select a valid challan or application.');return id;}
export async function studentPaymentTarget(req:NextRequest,session:JWTPayload,invoiceId:number):Promise<PaymentTarget> {
  if(!['STUDENT','PARENT'].includes(session.role)||!session.institutionId||session.mustChangePassword)throw new PaymentError('Payer session required.',401);
  let studentId=session.userId;
  if(session.role==='PARENT') {
    const context=await getParentPortalContext(session,req.nextUrl.searchParams.get('studentId'),{selectedOnly:true});
    if(!context.selectedChild)throw new PaymentError('Student not found.',404);
    studentId=context.selectedChild.id;
  }
  const [invoice]=await db.select({id:feeInvoices.id}).from(feeInvoices).where(and(eq(feeInvoices.id,invoiceId),eq(feeInvoices.institutionId,session.institutionId),eq(feeInvoices.studentId,studentId)));
  if(!invoice)throw new PaymentError('Challan not found.',404);
  return {institutionId:session.institutionId,studentId,invoiceId};
}
export async function admissionPaymentTarget(req:NextRequest,applicationId:number):Promise<PaymentTarget> {
  const session=await getAdmissionSessionFromRequest(req);
  if(!session)throw new PaymentError('Applicant session required.',401);
  const host=parseInstitutionHostname(req.headers.get('host')||'',await getPublicSiteBaseDomain());
  if(host.kind!=='institution')throw new PaymentError('Sign in through your institution website.',401);
  const [row]=await db.select({institutionId:admissionApplications.institutionId})
    .from(admissionApplications).innerJoin(admissionApplicantAccounts,and(eq(admissionApplicantAccounts.id,admissionApplications.applicantId),eq(admissionApplicantAccounts.institutionId,admissionApplications.intakeInstitutionId)))
    .innerJoin(institutions,eq(institutions.id,admissionApplications.intakeInstitutionId))
    .where(and(eq(admissionApplications.id,applicationId),eq(admissionApplications.applicantId,session.applicantId),eq(admissionApplications.intakeInstitutionId,session.institutionId),
      eq(admissionApplicantAccounts.sessionVersion,session.sessionVersion),eq(institutions.publicSlug,host.slug),eq(institutions.status,'APPROVED'),isNull(institutions.deletedAt)));
  if(!row)throw new PaymentError('Application not found.',404);
  return {applicationId,institutionId:row.institutionId};
}
