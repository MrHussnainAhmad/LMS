import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { withRateLimit } from '@/lib/rate-limit';
import { readPaymentConfig,publicPaymentConfig,gatewayId,PaymentError } from '@/lib/payments/config';
import { studentPaymentTarget,positiveId } from '@/lib/payments/targets';
import { createPaymentAttempt } from '@/lib/payments/service';
import { paymentResponse } from '@/lib/payments/http';
import { paymentPortalOrigin } from '@/lib/payments/endpoints';
export const GET=requireRole(['STUDENT','PARENT'],async(req,{session})=>paymentResponse(async()=>{
  const target=await studentPaymentTarget(req,session,positiveId(req.nextUrl.searchParams.get('invoiceId')));
  const config=publicPaymentConfig(await readPaymentConfig(target.institutionId));
  return NextResponse.json({mode:config.mode,gateways:config.gateways.filter(gateway=>gateway.ready).map(({id,environment})=>({id,environment}))},{headers:{'Cache-Control':'no-store'}});
}));
export const POST=requireRole(['STUDENT','PARENT'],async(req,{session})=>paymentResponse(async()=>{
  if(!(await withRateLimit(req,'upload',`online-payment:${session.institutionId}:${session.userId}`)).success)throw new PaymentError('Too many requests. Try again shortly.',429);
  const body=await req.json().catch(()=>null);const gateway=gatewayId.safeParse(body?.gateway);
  if(!gateway.success)throw new PaymentError('Select JazzCash or Easypaisa.');
  const target=await studentPaymentTarget(req,session,positiveId(body?.invoiceId));
  const attempt=await createPaymentAttempt(target,gateway.data,paymentPortalOrigin(req));
  return NextResponse.json({paymentId:attempt.id,url:`/payments/${attempt.id}`,environment:attempt.environment},{headers:{'Cache-Control':'no-store'}});
}));
