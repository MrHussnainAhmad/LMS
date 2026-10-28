import { NextRequest,NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { readPaymentConfig,publicPaymentConfig,gatewayId,PaymentError } from '@/lib/payments/config';
import { admissionPaymentTarget,positiveId } from '@/lib/payments/targets';
import { createPaymentAttempt } from '@/lib/payments/service';
import { paymentResponse } from '@/lib/payments/http';
import { paymentPortalOrigin } from '@/lib/payments/endpoints';
type Context={params:Promise<{applicationId:string}>};
export async function GET(req:NextRequest,{params}:Context){return paymentResponse(async()=>{
  const target=await admissionPaymentTarget(req,positiveId((await params).applicationId));
  const config=publicPaymentConfig(await readPaymentConfig(target.institutionId));
  return NextResponse.json({mode:config.mode,gateways:config.gateways.filter(gateway=>gateway.ready).map(({id,environment})=>({id,environment}))},{headers:{'Cache-Control':'no-store'}});
});}
export async function POST(req:NextRequest,{params}:Context){return paymentResponse(async()=>{
  const target=await admissionPaymentTarget(req,positiveId((await params).applicationId));
  if(!(await withRateLimit(req,'upload',`admission-online:${target.applicationId}`)).success)throw new PaymentError('Too many requests. Try again shortly.',429);
  const body=await req.json().catch(()=>null);const gateway=gatewayId.safeParse(body?.gateway);
  if(!gateway.success)throw new PaymentError('Select JazzCash or Easypaisa.');
  const attempt=await createPaymentAttempt(target,gateway.data,paymentPortalOrigin(req));
  return NextResponse.json({paymentId:attempt.id,url:`/payments/${attempt.id}`,environment:attempt.environment},{headers:{'Cache-Control':'no-store'}});
});}
