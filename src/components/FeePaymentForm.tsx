"use client";
import { useEffect,useState,type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { ManualPaymentForm } from './ManualPaymentForm';
import { PaymentHistory } from './PaymentHistory';
import { Button } from './ui/button';
type Props=ComponentProps<typeof ManualPaymentForm>&{applicationId?:number};
type Options={mode:'MANUAL'|'ONLINE';gateways:{id:'jazzcash'|'easypaisa';environment:string}[]};
export function FeePaymentForm({applicationId,...props}:Props) {
  const router=useRouter();
  const [options,setOptions]=useState<Options|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[gateway,setGateway]=useState('');
  const separator=props.endpoint.includes('?')?'&':'?';
  const checkoutEndpoint=applicationId?`/api/public/admissions/fees/${applicationId}/pay`:`${props.endpoint.split('?')[0]}/pay${props.endpoint.includes('?')?'?'+props.endpoint.split('?')[1]:''}`;
  const optionsUrl=checkoutEndpoint+(applicationId?'':`${separator}invoiceId=${props.invoiceId}`);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(optionsUrl,{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);setOptions(data);})
      .catch(error=>{if(!controller.signal.aborted)setError(error.message||'Could not load payment options.');});
    return()=>controller.abort();
  },[optionsUrl]);
  if(!options)return <p role={error?'alert':'status'} className="text-sm">{error||'Loading payment options…'}</p>;
  if(options.mode==='MANUAL')return <ManualPaymentForm {...props}/>;
  return <section className="space-y-4">
    <p className="text-sm">Pay this challan online. No screenshot or manual payment proof is required.</p>
    <p className="font-semibold">PKR {props.amount.toLocaleString('en-PK')}</p>
    <label className="block text-sm font-medium">Payment gateway<select value={gateway} onChange={event=>setGateway(event.target.value)} className="mt-2 block w-full rounded border bg-white p-3" disabled={busy}>
      <option value="">Select a gateway</option>{options.gateways.map(value=><option key={value.id} value={value.id}>{value.id==='jazzcash'?'JazzCash':'Easypaisa'}{value.environment==='sandbox'?' — Sandbox test':''}</option>)}
    </select></label>
    {!options.gateways.length&&<p role="status" className="text-sm">Online payments are not configured. Contact your institution.</p>}
    <Button disabled={busy||!gateway} onClick={async()=>{
      setBusy(true);setError('');
      try {
        const response=await fetch(checkoutEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gateway,invoiceId:props.invoiceId})});
        const data=await response.json();if(!response.ok)throw Error(data.error);
        router.push(`/payments/${encodeURIComponent(data.paymentId)}`);
      }catch(error){setError(error instanceof Error?error.message:'Could not start payment.');setBusy(false);}
    }}>{busy?'Preparing payment…':'Continue to payment'}</Button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <PaymentHistory invoiceId={props.invoiceId} applicationId={applicationId}/>
  </section>;
}
