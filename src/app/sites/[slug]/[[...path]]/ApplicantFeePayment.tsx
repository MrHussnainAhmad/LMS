"use client";
import { FeePaymentForm } from '@/components/FeePaymentForm';
export function ApplicantFeePayment({ applicationId, amount }: { applicationId: number; amount: number }) {
  return <FeePaymentForm endpoint={`/api/public/admissions/fees/${applicationId}`} applicationId={applicationId} amount={amount} />;
}
