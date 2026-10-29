"use client";
import { useEffect,useState,type FormEvent } from 'react';
import { PaymentAccountsSettings } from './PaymentAccountsSettings';
import { PaymentHistory } from './PaymentHistory';
import { Button } from './ui/button';
type Gateway={id:'jazzcash'|'easypaisa';configured:boolean;enabled:boolean;ready:boolean;notReadyReason?:string|null;environment:'sandbox'|'production';merchantId:string;username:string;accountNum:string};
type Settings={mode:'MANUAL'|'ONLINE';gateways:Gateway[]};
const endpoint='/api/institution/settings/payment-gateway';
const input='mt-1 block w-full rounded border border-border bg-white p-2 text-sm';
export function PaymentSettings() {
  const [settings,setSettings]=useState<Settings|null>(null),[mode,setMode]=useState<'MANUAL'|'ONLINE'>('MANUAL'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [feedbackGateway,setFeedbackGateway]=useState<Gateway['id']|null>(null);
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(data.error);setSettings(data);setMode(data.mode);
  }).catch(error=>{if(!controller.signal.aborted)setMessage(error.message);});return()=>controller.abort();},[]);
  async function save(body:unknown,gatewayId:Gateway['id']|null=null) {
    setFeedbackGateway(gatewayId);
    setBusy(true);setMessage('');
    try {
      const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw Error(data.error);setSettings(data);setMessage('Payment settings saved.');return true;
    }catch(error){setMessage(error instanceof Error?error.message:'Could not save payment settings.');return false;}
    finally{setBusy(false);}
  }
  async function saveGateway(event:FormEvent<HTMLFormElement>,gateway:Gateway) {
    event.preventDefault();const form=event.currentTarget;const values=new FormData(form);
    const credentials=Object.fromEntries((gateway.id==='jazzcash'?['merchantId','password','integritySalt']:['storeId','accountNum','username','password']).map(key=>[key,String(values.get(key)||'')]));
    if(await save({action:'gateway',gateway:gateway.id,enabled:values.get('enabled')==='on',environment:values.get('environment'),credentials},gateway.id)) {
      for(const name of ['password','integritySalt']){const field=form.elements.namedItem(name);if(field instanceof HTMLInputElement)field.value='';}
    }
  }
  return <div className="space-y-6">
    <fieldset disabled={busy} className="space-y-3"><legend className="text-sm font-semibold">Payment type</legend>
      <div className="grid gap-3 sm:grid-cols-2">{(['MANUAL','ONLINE'] as const).map(value=><label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${mode===value?'border-brand-400 bg-brand-50':'border-border'}`}>
        <input type="radio" name="institution-payment-mode" value={value} checked={mode===value} onChange={()=>setMode(value)} className="mt-1 accent-brand-700"/>
        <span><span className="block text-sm font-semibold">{value==='MANUAL'?'Manual':'Online'}{settings?.mode===value?' — Active':''}</span>
          <span className="mt-1 block text-xs leading-5 text-stone-500">{value==='MANUAL'?'Payers submit proof for institution review.':'Payers choose JazzCash or Easypaisa; verified payments create receipts automatically.'}</span></span>
      </label>)}</div>
    </fieldset>
    {!settings&&!message&&<p role="status">Loading payment settings…</p>}
    {settings&&mode==='ONLINE'&&<div className="grid gap-4 lg:grid-cols-2">{settings.gateways.map(gateway=><form key={`${gateway.id}:${gateway.environment}:${gateway.merchantId}`} onSubmit={event=>void saveGateway(event,gateway)} className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="font-semibold">{gateway.id==='jazzcash'?'JazzCash':'Easypaisa'} <span className="text-xs font-normal text-stone-500">{gateway.ready?'Ready':gateway.configured?'Configured — not ready':'Not configured'}</span></h3>
      <p className="text-xs text-stone-500">{gateway.id==='jazzcash'?'Hosted Mobile Wallet checkout':'Mobile Account — REST v4 merchant profile'}</p>
      {gateway.notReadyReason&&<p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm" role="status">{gateway.notReadyReason}</p>}
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs font-medium">Environment<select name="environment" defaultValue={gateway.environment} className={input}><option value="sandbox">Sandbox testing</option><option value="production">Production</option></select></label>
        <p className="text-xs text-stone-500">Saving production credentials does not verify them or activate live payments.</p>
        <label className="block text-xs font-medium">{gateway.id==='jazzcash'?'Merchant ID':'Store ID'}<input name={gateway.id==='jazzcash'?'merchantId':'storeId'} defaultValue={gateway.merchantId} maxLength={160} required className={input}/></label>
        {gateway.id==='easypaisa'&&<><label className="block text-xs font-medium">EWP account number<input name="accountNum" defaultValue={gateway.accountNum} maxLength={32} required className={input}/></label><label className="block text-xs font-medium">API username<input name="username" defaultValue={gateway.username} maxLength={160} required className={input}/></label></>}
        <label className="block text-xs font-medium">Merchant / API password<input name="password" type="password" autoComplete="new-password" maxLength={256} required={!gateway.configured} placeholder={gateway.configured?'Saved — leave blank to keep':'Provider-issued password'} className={input}/></label>
        {gateway.id==='jazzcash'&&<label className="block text-xs font-medium">Integrity salt<input name="integritySalt" type="password" autoComplete="new-password" maxLength={256} required={!gateway.configured} placeholder={gateway.configured?'Saved — leave blank to keep':'Provider-issued integrity salt'} className={input}/></label>}
        <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={gateway.enabled}/>Enable this gateway</label>
        <Button type="submit" disabled={busy}>Save {gateway.id==='jazzcash'?'JazzCash':'Easypaisa'}</Button>
      </fieldset>
      {feedbackGateway===gateway.id&&message&&<p role="status" className="rounded border p-3 text-sm">{message}</p>}
    </form>)}</div>}
    {settings&&mode!==settings.mode&&<Button disabled={busy} onClick={()=>void save({action:'mode',mode})}>Use {mode==='MANUAL'?'Manual':'Online'} payments</Button>}
    {!feedbackGateway&&message&&<p role="status" className="rounded border p-3 text-sm">{message}</p>}
    {settings&&mode==='MANUAL'&&<PaymentAccountsSettings/>}
    <PaymentHistory/>
  </div>;
}
