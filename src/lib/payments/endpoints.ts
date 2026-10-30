import type { GatewayId } from './config';
import type { NextRequest } from 'next/server';

export function gatewayEndpoint(gateway:GatewayId,environment:'sandbox'|'production',operation:'checkout'|'initiate'|'inquiry') {
  const prefix=`${gateway.toUpperCase()}_${environment==='sandbox'?'SANDBOX_':''}`;
  const allowed=gateway==='jazzcash'
    ? environment==='sandbox'?['sandbox.jazzcash.com.pk']:['payments.jazzcash.com.pk']
    : environment==='sandbox'?['easypaystg.easypaisa.com.pk']:['easypay.easypaisa.com.pk'];
  if((gateway==='jazzcash'&&operation!=='checkout')||(gateway==='easypaisa'&&operation==='checkout'))throw new Error('Unsupported merchant operation');
  const path=gateway==='jazzcash'?'/CustomerPortal/transactionmanagement/merchantform/'
    : `/easypay-service/rest/v4/${operation==='initiate'?'initiate-ma-transaction':'inquire-transaction'}`;
  const value=process.env[`${prefix}${operation.toUpperCase()}_URL`]?.trim()||`https://${allowed[0]}${path}`;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed.includes(url.hostname)||url.hash||url.search)throw new Error('Invalid merchant endpoint');
  if(gateway==='easypaisa'&&!url.pathname.endsWith(`/easypay-service/rest/v4/${operation==='initiate'?'initiate-ma-transaction':'inquire-transaction'}`))throw new Error('This adapter requires the merchant-approved REST v4 contract');
  return url.toString();
}
export function endpointsReady(gateway:GatewayId,environment:'sandbox'|'production') {
  try {
    if(gateway==='jazzcash')return false; // Hosted form discloses reusable merchant password.
    else {gatewayEndpoint(gateway,environment,'initiate');gatewayEndpoint(gateway,environment,'inquiry');}
    return true;
  }catch{return false;}
}
export function paymentOrigin() {
  const url=new URL(process.env.PAYMENT_PUBLIC_ORIGIN||`https://${process.env.APP_DOMAIN||'nisaab360.app'}`);
  if(url.pathname!=='/'||url.search||url.hash||url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Invalid public payment origin');
  return url.origin;
}
export function paymentPortalOrigin(req:NextRequest) {
  const configured=new URL(paymentOrigin());
  const domain=new URL(`https://${process.env.APP_DOMAIN||'nisaab360.app'}`).hostname;
  const host=req.headers.get('host')||new URL(req.url).host;
  const url=new URL(`https://${host}`);
  if(['localhost','127.0.0.1'].includes(url.hostname)&&url.hostname===configured.hostname)return configured.origin;
  if(url.port||url.username||url.password||url.pathname!=='/'||!(url.hostname===domain||url.hostname.endsWith('.'+domain)))throw new Error('Invalid payer portal');
  return url.origin;
}
export async function providerJson(url:string,body:Record<string,unknown>,headers:Record<string,string>,timeout=45000) {
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeout),headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  if(!response.ok)throw new Error('Provider request could not be confirmed');
  const reader=response.body?.getReader();if(!reader)throw new Error('Empty provider response');
  const chunks:Uint8Array[]=[];let length=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536)throw new Error('Provider response too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>undefined);}
  const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Invalid provider response');
  return result as Record<string,unknown>;
}
