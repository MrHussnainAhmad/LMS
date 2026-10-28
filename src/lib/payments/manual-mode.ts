import { and,eq,isNull,sql } from 'drizzle-orm';
import { gatewayPaymentAttempts as attempts } from '@/db/schema';
import { readPaymentConfig,PaymentError,type PaymentExecutor } from './config';
export async function assertManualPayment(tx:PaymentExecutor,institutionId:number,target?:{invoiceId?:number;applicationId?:number}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(36077,${institutionId})`);
  if((await readPaymentConfig(institutionId,tx,true)).mode!=='MANUAL')throw new PaymentError('Manual payments are disabled. Use Online checkout.',409);
  if(target) {
    const filter=and(eq(attempts.institutionId,institutionId),target.invoiceId?eq(attempts.invoiceId,target.invoiceId):eq(attempts.applicationId,target.applicationId!),eq(attempts.status,'PENDING'),isNull(attempts.closedAt));
    const pending=await tx.select({id:attempts.id,started:attempts.initiationStartedAt}).from(attempts).where(filter).for('update');
    if(pending.some(attempt=>attempt.started))throw new PaymentError('An online payment is awaiting confirmation. Check it before submitting a manual payment.',409);
    for(const attempt of pending)await tx.update(attempts).set({closedAt:new Date(),providerResponseCode:'NOT_STARTED'}).where(eq(attempts.id,attempt.id));
  }
}
