"use client";
import { useEffect,useState,type FormEvent } from 'react';
import { paymentStatus,type PublicPayment } from '@/components/PaymentHistory';
import { Button } from '@/components/ui/button';
export function PaymentDetails({id}:{id:string}) {
  const [payment,setPayment]=useState<PublicPayment|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const endpoint=`/api/payments/${encodeURIComponent(id)}`;
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(data.error);setPayment(data.payment);
  }).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[endpoint]);
  async function action(body:unknown) {
    setBusy(true);setError('');
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      if(data.checkout) {
        // Hosted JazzCash requires its prescribed merchant fields. Keep them
        // transient: never log, persist or inject them as unescaped HTML.
        const form=document.createElement('form');form.method='POST';form.action=data.checkout.url;
        for(const [name,value] of Object.entries(data.checkout.fields as Record<string,string>)) {
          const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);
        }
        document.body.append(form);form.submit();return;
      }
      const updated=await fetch(endpoint,{cache:'no-store'});const result=await updated.json();if(!updated.ok)throw Error(result.error);setPayment(result.payment);
    }catch(error){setError(error instanceof Error?error.message:'Payment could not be confirmed.');}
    finally{setBusy(false);}
  }
  async function start(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const values=new FormData(event.currentTarget);
    await action({action:'start',phone:values.get('phone'),email:values.get('email')});
  }
  return <main className="mx-auto max-w-xl space-y-5 p-6">
    <h1 className="text-2xl font-semibold">Payment & receipt</h1>
    {payment&&<>
      {payment.environment==='sandbox'&&<p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Sandbox test. This does not pay your real challan or change its balance.</p>}
      <dl className="space-y-2 rounded border bg-white p-4 text-sm"><div><dt>Institution</dt><dd className="font-semibold">{payment.institutionName}</dd></div><div><dt>Payer</dt><dd>{payment.payerName}</dd></div><div><dt>Fee</dt><dd>{payment.description}</dd></div><div><dt>Amount</dt><dd className="text-lg font-semibold">PKR {payment.amount.toLocaleString('en-PK')}</dd></div><div><dt>Status</dt><dd>{paymentStatus(payment)}</dd></div><div><dt>Payment reference</dt><dd className="break-all font-mono">{payment.receiptNumber||payment.id}</dd></div>{payment.providerReference&&<div><dt>Provider reference</dt><dd>{payment.providerReference}</dd></div>}</dl>
      {payment.status==='PENDING'&&!payment.closedAt&&<>
        {!payment.initiationStartedAt&&<form onSubmit={event=>void start(event)} className="space-y-3 rounded border p-4">
          <p className="text-sm">{payment.gateway==='jazzcash'?'Continue to JazzCash to complete payment.':'Enter your Easypaisa mobile account and approve the request in Easypaisa.'}</p>
          {payment.gateway==='easypaisa'&&<><label className="block text-sm">Mobile number<input name="phone" type="tel" inputMode="numeric" pattern="03[0-9]{9}" maxLength={11} placeholder="03XXXXXXXXX" required className="mt-1 block w-full rounded border p-2"/></label>
          <label className="block text-sm">Email<input name="email" type="email" maxLength={255} required className="mt-1 block w-full rounded border p-2"/></label></>}
          <Button disabled={busy} type="submit">{busy?'Please wait…':'Continue payment'}</Button>
        </form>}
        <p className="text-xs text-stone-500">Already approved or debited? Check status before trying another payment.</p>
        <Button variant="outline" disabled={busy} onClick={()=>void action({action:'refresh'})}>Check payment status</Button>
        {payment.environment==='sandbox'&&<Button variant="outline" disabled={busy} onClick={()=>void action({action:'resetSandbox'})}>Close sandbox test attempt</Button>}
      </>}
      {payment.receiptNumber&&<Button variant="outline" onClick={()=>window.print()}>Print receipt</Button>}
    </>}
    {error&&<p role="alert" className="rounded border border-red-200 p-3 text-sm text-red-700">{error}</p>}
  </main>;
}
