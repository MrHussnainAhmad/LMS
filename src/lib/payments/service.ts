import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { gatewayPaymentAttempts as attempts, feeInvoices, feePayments, students, institutions,
  admissionApplications, admissionFeePayments, admissionCycles, feePaymentSubmissions } from '@/db/schema';
import { encryptStreamingCredentials, decryptStreamingCredentials } from '@/lib/streaming-credentials';
import { PaymentError, readPaymentConfig, publicPaymentConfig, type GatewayId, type GatewayConfig, type PaymentExecutor } from './config';
import { paymentOrigin } from './endpoints';
import { inquireEasypaisa, initiateEasypaisa, jazzCashCheckout, type PaymentEvidence } from './providers';

export type PaymentTarget={institutionId:number;invoiceId?:number;applicationId?:number;studentId?:number};
export function credentialSnapshot(config:GatewayConfig){return encryptStreamingCredentials({gatewayV1:JSON.stringify(config)});}
export function attemptCredentials(attempt:typeof attempts.$inferSelect):GatewayConfig {
  const text=decryptStreamingCredentials(attempt.credentialsEncrypted)?.gatewayV1;
  if(!text)throw new PaymentError('This historical payment requires institution support.',409);
  const config=JSON.parse(text) as GatewayConfig;
  if(config.environment!==attempt.environment)throw new Error('Invalid payment credential snapshot');
  return config;
}
export async function getPaymentAttempt(id:string) {
  const [attempt]=await db.select().from(attempts).where(eq(attempts.id,id)).limit(1);
  if(!attempt)throw new PaymentError('Payment not found.',404);
  return attempt;
}
async function targetTerms(tx:PaymentExecutor,target:PaymentTarget) {
  const [institution]=await tx.select({name:institutions.name}).from(institutions).where(and(eq(institutions.id,target.institutionId),eq(institutions.status,'APPROVED'),isNull(institutions.deletedAt))).limit(1);
  if(!institution)throw new PaymentError('Institution is unavailable.',409);
  if(target.invoiceId) {
    const [invoice]=await tx.select().from(feeInvoices).where(and(eq(feeInvoices.id,target.invoiceId),eq(feeInvoices.institutionId,target.institutionId),eq(feeInvoices.studentId,target.studentId!))).for('update');
    if(!invoice||!['DUE','PARTIAL'].includes(invoice.status))throw new PaymentError('This challan is not awaiting payment.',409);
    const [proof]=await tx.select({id:feePaymentSubmissions.id}).from(feePaymentSubmissions).where(and(eq(feePaymentSubmissions.invoiceId,invoice.id),eq(feePaymentSubmissions.status,'SUBMITTED'))).limit(1);
    if(proof)throw new PaymentError('A manual payment is already awaiting review.',409);
    const [student]=await tx.select({name:students.name}).from(students).where(and(eq(students.id,invoice.studentId),eq(students.institutionId,target.institutionId),isNull(students.deletedAt)));
    if(!student)throw new PaymentError('Student is unavailable.',409);
    return {amount:invoice.totalAmount-invoice.paidAmount,payerName:student.name,institutionName:institution.name,description:`Challan ${invoice.id}`};
  }
  const [application]=await tx.select().from(admissionApplications).where(and(eq(admissionApplications.id,target.applicationId!),eq(admissionApplications.institutionId,target.institutionId))).for('update');
  const [fee]=await tx.select().from(admissionFeePayments).where(and(eq(admissionFeePayments.applicationId,target.applicationId!),eq(admissionFeePayments.institutionId,target.institutionId))).for('update');
  const [cycle]=application?await tx.select({archivedAt:admissionCycles.archivedAt}).from(admissionCycles).where(eq(admissionCycles.id,application.cycleId)):[];
  if(!application||!fee||cycle?.archivedAt||application.status!=='FEE_PENDING'||!['PENDING','REJECTED'].includes(fee.status))throw new PaymentError('This admission fee is not awaiting payment.',409);
  return {amount:fee.amount,payerName:application.studentName,institutionName:institution.name,description:`Admission ${application.applicationNumber}`};
}
export async function createPaymentAttempt(target:PaymentTarget,gateway:GatewayId,portalOrigin=paymentOrigin()) {
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(36077,${target.institutionId})`);
    const config=await readPaymentConfig(target.institutionId,tx,true);
    const selected=config.gateways[gateway];
    if(config.mode!=='ONLINE'||!selected||!publicPaymentConfig(config).gateways.find(value=>value.id===gateway)?.ready)throw new PaymentError('This online gateway is not available.',409);
    const terms=await targetTerms(tx,target);
    if(!Number.isSafeInteger(terms.amount)||terms.amount<1||terms.amount>21474836)throw new PaymentError('This challan amount is outside the supported online payment range.');
    const where=and(eq(attempts.institutionId,target.institutionId),target.invoiceId?eq(attempts.invoiceId,target.invoiceId):eq(attempts.applicationId,target.applicationId!),eq(attempts.status,'PENDING'),isNull(attempts.closedAt));
    const pending=await tx.select().from(attempts).where(where).orderBy(attempts.createdAt).for('update');
    for(const attempt of pending) {
      if(!attempt.initiationStartedAt&&attempt.expiresAt.getTime()<Date.now()) {
        await tx.update(attempts).set({closedAt:new Date(),providerResponseCode:'NOT_STARTED'}).where(eq(attempts.id,attempt.id));continue;
      }
      if(attempt.gateway!==gateway||attempt.amount!==terms.amount||attempt.environment!==selected.environment)throw new PaymentError('Check the existing payment attempt before starting another gateway or amount.',409);
      return attempt;
    }
    const id='N'+randomBytes(9).toString('hex').toUpperCase();
    const [attempt]=await tx.insert(attempts).values({...terms,id,createdAt:new Date(),institutionId:target.institutionId,invoiceId:target.invoiceId,applicationId:target.applicationId,
      gateway,environment:selected.environment,merchantId:selected.credentials.merchantId||selected.credentials.storeId,
      credentialsEncrypted:credentialSnapshot(selected),portalOrigin,returnUrl:`${paymentOrigin()}/api/payments/jazzcash/return`,expiresAt:new Date(Date.now()+30*60*1000)}).returning();
    return attempt;
  });
}
export async function settlePayment(id:string,evidence:PaymentEvidence) {
  if(!evidence.paid) {
    await db.update(attempts).set({providerResponseCode:evidence.responseCode.slice(0,20),evidenceDigest:evidence.digest.toLowerCase()}).where(and(eq(attempts.id,id),eq(attempts.status,'PENDING')));
    return;
  }
  return db.transaction(async tx=>{
    const [attempt]=await tx.select().from(attempts).where(eq(attempts.id,id)).for('update');
    if(!attempt)throw new PaymentError('Payment not found.',404);
    if(attempt.status!=='PENDING') {
      if(attempt.providerReference!==evidence.reference)throw new PaymentError('Payment reference conflict.',409);
      return attempt;
    }
    let status:'PAID'|'REVIEW'='PAID';
    const receiptNumber=`${attempt.environment==='sandbox'?'TEST':'OP'}-${attempt.id}`;
    if(attempt.environment==='production') {
      if(attempt.invoiceId) {
        const [invoice]=await tx.select().from(feeInvoices).where(and(eq(feeInvoices.id,attempt.invoiceId),eq(feeInvoices.institutionId,attempt.institutionId))).for('update');
        if(!invoice||!['DUE','PARTIAL'].includes(invoice.status)||invoice.totalAmount-invoice.paidAmount!==attempt.amount)status='REVIEW';
        else {
          await tx.insert(feePayments).values({institutionId:attempt.institutionId,invoiceId:invoice.id,studentId:invoice.studentId,receiptNumber,
            amount:attempt.amount,method:attempt.gateway==='jazzcash'?'JAZZCASH':'EASYPAISA',reference:evidence.reference,recordedBy:0,notes:`Verified online payment ${attempt.id}`});
          await tx.update(feeInvoices).set({paidAmount:invoice.paidAmount+attempt.amount,status:'PAID',updatedAt:new Date()}).where(eq(feeInvoices.id,invoice.id));
          await (await import('../notification-delivery')).createNotification({institutionId:attempt.institutionId,userRole:'STUDENT',userId:invoice.studentId,type:'PAYMENT',title:'Payment confirmed',message:'Your online fee payment has been verified.',referenceId:invoice.id,eventKey:`online-payment:${attempt.id}`},tx);
        }
      } else {
        const [application]=await tx.select().from(admissionApplications).where(and(eq(admissionApplications.id,attempt.applicationId!),eq(admissionApplications.institutionId,attempt.institutionId))).for('update');
        const [fee]=await tx.select().from(admissionFeePayments).where(and(eq(admissionFeePayments.applicationId,attempt.applicationId!),eq(admissionFeePayments.institutionId,attempt.institutionId))).for('update');
        const [cycle]=application?await tx.select({archivedAt:admissionCycles.archivedAt}).from(admissionCycles).where(eq(admissionCycles.id,application.cycleId)):[];
        if(!application||!fee||cycle?.archivedAt||application.status!=='FEE_PENDING'||!['PENDING','REJECTED'].includes(fee.status)||fee.amount!==attempt.amount)status='REVIEW';
        else {
          await tx.update(admissionFeePayments).set({status:'VERIFIED',payerReference:evidence.reference,payerSourceBank:attempt.gateway,
            verifiedAt:new Date(),reviewerNote:`Online receipt ${receiptNumber}`,updatedAt:new Date()}).where(eq(admissionFeePayments.id,fee.id));
          await tx.update(admissionApplications).set({status:'FEE_VERIFIED',updatedAt:new Date()}).where(eq(admissionApplications.id,application.id));
        }
      }
    }
    const [updated]=await tx.update(attempts).set({status,receiptNumber,providerReference:evidence.reference,
      providerResponseCode:evidence.responseCode.slice(0,20),evidenceDigest:evidence.digest.toLowerCase(),verifiedAt:new Date(),closedAt:null})
      .where(eq(attempts.id,id)).returning();
    return updated;
  });
}
export async function refreshPayment(id:string) {
  const attempt=await getPaymentAttempt(id);
  if(attempt.status!=='PENDING'||attempt.closedAt||attempt.gateway!=='easypaisa'||!attempt.initiationStartedAt)return attempt;
  // A DB compare-and-set limits polling across both app replicas.
  const claimed=await db.update(attempts).set({lastCheckedAt:new Date()}).where(and(eq(attempts.id,id),eq(attempts.status,'PENDING'),
    sql`(${attempts.lastCheckedAt} IS NULL OR ${attempts.lastCheckedAt}<(now() AT TIME ZONE 'UTC')-interval '15 seconds')`)).returning({id:attempts.id});
  if(!claimed.length)return attempt;
  const config=attemptCredentials(attempt);
  const evidence=await inquireEasypaisa(attempt,config.credentials);
  if(evidence.paid)return (await settlePayment(id,evidence))!;
  if(evidence.closed)await db.update(attempts).set({closedAt:new Date(),providerResponseCode:evidence.responseCode.slice(0,20)}).where(and(eq(attempts.id,id),eq(attempts.status,'PENDING')));
  return getPaymentAttempt(id);
}
export async function startPayment(id:string,payer:{phone:string;email:string}) {
  const attempt=await getPaymentAttempt(id);
  if(attempt.status!=='PENDING'||attempt.closedAt||attempt.expiresAt.getTime()<Date.now())throw new PaymentError('This attempt cannot start another payment. Check its status first.',409);
  const claim=await db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(36077,${attempt.institutionId})`);
    const current=await readPaymentConfig(attempt.institutionId,tx,true);
    const gateway=current.gateways[attempt.gateway as GatewayId];
    if(current.mode!=='ONLINE'||!publicPaymentConfig(current).gateways.find(value=>value.id===attempt.gateway)?.ready
      ||gateway?.environment!==attempt.environment||(gateway.credentials.merchantId||gateway.credentials.storeId)!==attempt.merchantId)
      throw new PaymentError('This gateway is disabled or its merchant settings changed. Contact your institution.',409);
    return tx.update(attempts).set({initiationStartedAt:new Date()}).where(and(eq(attempts.id,id),eq(attempts.status,'PENDING'),isNull(attempts.closedAt),
      isNull(attempts.initiationStartedAt),sql`${attempts.expiresAt}>(now() AT TIME ZONE 'UTC')`)).returning({id:attempts.id});
  });
  if(!claim.length)throw new PaymentError('Payment already started. Check its status before retrying.',409);
  const config=attemptCredentials(attempt);
  if(attempt.gateway==='jazzcash')return {checkout:jazzCashCheckout(attempt,config.credentials)};
  if(attempt.gateway!=='easypaisa')throw new PaymentError('Gateway unavailable.',409);
  await initiateEasypaisa(attempt,config,payer);
  return {payment:await refreshPayment(id)};
}
