import { NextResponse } from 'next/server';
import { requireRole,getTenantContext } from '@/lib/rbac';
import { readPaymentConfig,publicPaymentConfig,updatePaymentConfig } from '@/lib/payments/config';
import { paymentResponse } from '@/lib/payments/http';
export const GET=requireRole(['INSTITUTION'],async(_req,{session})=>paymentResponse(async()=>NextResponse.json(publicPaymentConfig(await readPaymentConfig(getTenantContext(session))),{headers:{'Cache-Control':'no-store'}})));
export const PUT=requireRole(['INSTITUTION'],async(req,{session})=>paymentResponse(async()=>{
  const body=await req.json().catch(()=>null);
  return NextResponse.json(await updatePaymentConfig(getTenantContext(session),body),{headers:{'Cache-Control':'no-store'}});
}));
