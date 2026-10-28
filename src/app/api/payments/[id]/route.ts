import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gatewayPaymentAttempts } from "@/db/schema";
import { paymentAccess, publicPaymentFields } from "@/lib/payments/access";
import { z } from 'zod';
import { startPayment,refreshPayment } from '@/lib/payments/service';
import { paymentResponse } from '@/lib/payments/http';
import { PaymentError } from '@/lib/payments/config';
import { withRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await paymentAccess(req); const { id } = await params;
  if (!access) return NextResponse.json({ error: "Sign in through your portal to view this payment" }, { status: 401 });
  if (!/^[A-Za-z0-9]{1,20}$/.test(id)) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const [payment] = await db.select({ ...publicPaymentFields, qrImage: gatewayPaymentAttempts.qrImage }).from(gatewayPaymentAttempts).where(and(access, eq(gatewayPaymentAttempts.id, id)));
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json({ payment }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  return paymentResponse(async()=>{
    const access=await paymentAccess(req);const {id}=await params;
    if(!access)throw new PaymentError('Sign in to access this payment.',401);
    const [owned]=await db.select({id:gatewayPaymentAttempts.id,gateway:gatewayPaymentAttempts.gateway}).from(gatewayPaymentAttempts).where(and(access,eq(gatewayPaymentAttempts.id,id)));
    if(!owned)throw new PaymentError('Payment not found.',404);
    if(!(await withRateLimit(req,'upload',`payment-action:${id}`)).success)throw new PaymentError('Try again shortly.',429);
    const body=await req.json().catch(()=>null);
    if(body?.action==='refresh') {
      await refreshPayment(id);
      return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
    }
    if(body?.action==='resetSandbox') {
      await db.update(gatewayPaymentAttempts).set({closedAt:new Date(),providerResponseCode:'SANDBOX_RESET'})
        .where(and(access,eq(gatewayPaymentAttempts.id,id),eq(gatewayPaymentAttempts.environment,'sandbox'),eq(gatewayPaymentAttempts.status,'PENDING')));
      return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store'}});
    }
    if(body?.action!=='start')throw new PaymentError('Invalid payment action.');
    const payer=z.object({phone:z.string().regex(/^03\d{9}$/),email:z.string().email().max(255)}).safeParse(body);
    if(owned.gateway==='jazzcash')return NextResponse.json(await startPayment(id,{phone:'',email:''}),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    if(!payer.success)throw new PaymentError('Enter an 11-digit mobile number and a valid email.');
    return NextResponse.json(await startPayment(id,payer.data),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  });
}
