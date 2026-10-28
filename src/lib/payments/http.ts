import { NextResponse } from 'next/server';
import { PaymentError } from './config';
export async function readPaymentBody(request:Request,maximum=16384) {
  if(Number(request.headers.get('content-length')||0)>maximum)throw new PaymentError('Payment message is too large.',413);
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>maximum)throw new PaymentError('Payment message is too large.',413);chunks.push(value);}}
  finally{await reader.cancel().catch(()=>undefined);}
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
}

export async function paymentResponse<T extends Response>(work:()=>Promise<T>):Promise<T|NextResponse> {
  try{return await work();}catch(error){
    if(error instanceof PaymentError)return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
    console.error('[payments] Request could not be confirmed');
    return NextResponse.json({error:'Payment could not be confirmed. Check its status before trying again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
