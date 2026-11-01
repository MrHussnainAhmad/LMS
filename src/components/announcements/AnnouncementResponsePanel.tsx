"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AnnouncementResponse, AnnouncementResponsePolicy } from '@/db/schema';

export function AnnouncementResponsePanel({id,studentId,policy,response:initialResponse,isRead=false,parent=false}:{
  id:number;studentId?:number;policy?:AnnouncementResponsePolicy;response?:AnnouncementResponse;isRead?:boolean;parent?:boolean;
}){
  const [read,setRead]=useState(isRead),[response,setResponse]=useState(initialResponse),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const send=async(answer?:'ACKNOWLEDGED'|'YES'|'NO')=>{
    setBusy(true);setError('');
    try{
      const result=await fetch('/api/announcements/'+id+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId,answer})}),data=await result.json();
      if(!result.ok)throw new Error(data.error||'Could not record your response.');
      setRead(true);setResponse(data.notice?.response);
    }catch(err){setError(err instanceof Error?err.message:'Could not record your response.');}finally{setBusy(false);}
  };
  return <div className="mt-4 space-y-2 border-t border-border pt-3">
    {policy?.dueDate&&<p className="text-xs text-stone-500">Response due {policy.dueDate}</p>}
    {response?.answer?<p role="status" className="text-sm font-medium text-brand-800">Your response: {response.answer.replaceAll('_',' ')}{response.at?' / '+new Date(response.at).toLocaleString():''}</p>:
      <div className="flex flex-wrap gap-2">
        {!read&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>send()}>Mark as read</Button>}
        {policy?.mode==='ACKNOWLEDGE'&&<Button size="sm" disabled={busy} onClick={()=>send('ACKNOWLEDGED')}>I acknowledge this notice</Button>}
        {policy?.mode==='CONSENT'&&parent&&<><Button size="sm" disabled={busy} onClick={()=>send('YES')}>I give consent</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>send('NO')}>I do not give consent</Button></>}
        {read&&(!policy?.mode||policy.mode==='NONE')&&<span className="text-xs text-stone-500">Read</span>}
      </div>}
    {policy?.mode==='CONSENT'&&!parent&&<p className="text-xs text-stone-500">A linked parent must respond. Reading this notice does not give consent.</p>}
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}
