import { NextRequest,NextResponse } from 'next/server';
import { getPaymentAttempt,attemptCredentials,settlePayment } from '@/lib/payments/service';
import { verifyJazzCash } from '@/lib/payments/providers';
import { paymentOrigin } from '@/lib/payments/endpoints';
import { readPaymentBody } from '@/lib/payments/http';
import { nativeCheckoutHtml } from '@/lib/payments/native-checkout';
export async function POST(req:NextRequest) {
  try {
    const text=await readPaymentBody(req);
    const parameters=new URLSearchParams(text);const fields:Record<string,string>={};
    for(const [key,value] of parameters) {if(Object.hasOwn(fields,key)||value.length>2048)throw new Error('Invalid callback');fields[key]=value;}
    if(!/^[A-Za-z0-9]{1,20}$/.test(fields.pp_TxnRefNo||''))throw new Error('Invalid callback');
    const attempt=await getPaymentAttempt(fields.pp_TxnRefNo);
    if(attempt.gateway!=='jazzcash')throw new Error('Gateway mismatch');
    const evidence=verifyJazzCash(fields,attempt,attemptCredentials(attempt).credentials);
    await settlePayment(attempt.id,evidence);
    if(req.cookies.get('nisaab360_native_payment')?.value===attempt.id) {
      const page=nativeCheckoutHtml(undefined,'Your payment response was received. Return to the Nisaab360 app and choose Check status to see the verified result.');
      const response=new NextResponse(page.body,{headers:page.headers});
      response.cookies.set('nisaab360_native_payment','',{path:'/api/payments/jazzcash/return',maxAge:0,httpOnly:true,secure:true,sameSite:'none'});
      return response;
    }
    const response=NextResponse.redirect(new URL(`/payments/${attempt.id}`,attempt.portalOrigin||paymentOrigin()),303);
    response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
  }catch {
    return NextResponse.json({error:'Payment confirmation could not be verified. Check your payment record.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
