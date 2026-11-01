"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { csvCell } from '@/lib/csv';

type Session = {id:number;name:string;startDate:string;endDate:string;isCurrent:boolean;record:{closedAt?:string;openingBalance?:number;archivedStudents?:number;closingRoster?:Array<Record<string,unknown>>}};
type Preview = {previewHash:string;current:{id:number;name:string}|null;students:number;carryForwardBalance:number;classes:Array<{classId:number;className:string;sectionId:number|null;sectionName:string|null;students:number}>};
const input = 'w-full rounded-md border border-border bg-white px-3 py-2 text-sm';

export function AcademicSessionPanel() {
  const [open,setOpen]=useState(false),[sessions,setSessions]=useState<Session[]>([]);
  const [name,setName]=useState(''),[startDate,setStart]=useState(''),[endDate,setEnd]=useState('');
  const [rolloverId,setRolloverId]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null),[confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load = async () => {
    const response=await fetch('/api/institution/academics?view=sessions',{cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error || 'Could not load academic sessions.');setSessions(data.sessions);
  };
  const run = async (apply:boolean) => {
    setBusy(true);setError('');setMessage('');
    try {
      const response=await fetch('/api/institution/academics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        action:apply?'rolloverSession':'previewSession',name,startDate,endDate,
        ...(apply?{expectedPreviewHash:preview?.previewHash,rolloverId,confirm:true}:{}),
      })});
      const data=await response.json();if(!response.ok)throw new Error(data.error || 'Could not prepare the session.');
      if(apply){setConfirm(false);setPreview(null);setMessage('The new academic session is active. Existing invoices and payment records remain on their original ledger.');await load();}
      else {setRolloverId(crypto.randomUUID());setPreview(data);}
    }catch(err){setError(err instanceof Error?err.message:'Could not prepare the session.');}finally{setBusy(false);}
  };
  const archive = async (id:number) => {
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/institution/academics?view=sessions&sessionId='+id,{cache:'no-store'}),data=await response.json();
      if(!response.ok)throw new Error(data.error);
      const session=data.sessions.find((row:Session)=>row.id===id) as Session;
      const rows=session.record.closingRoster ?? [];
      if(!rows.length)throw new Error('This session has no closed-year roster yet.');
      const columns=['id','name','loginId','roll','className','sectionName','academicStatus','balance'];
      const csv=[columns.map(csvCell).join(','),...rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
      link.href=url;link.download='academic-session-'+id+'.csv';link.click();URL.revokeObjectURL(url);
    }catch(err){setError(err instanceof Error?err.message:'Could not export the session.');}finally{setBusy(false);}
  };
  return <Card><CardHeader className="flex flex-wrap flex-row items-center justify-between gap-3"><div><CardTitle>Academic-year rollover</CardTitle><CardDescription>Review the next session, archive current class placements, and keep fee balances on the existing ledger.</CardDescription></div>
    <Button variant="outline" disabled={busy} onClick={async()=>{setOpen(value=>!value);if(!open){setBusy(true);try{await load();}catch(err){setError(err instanceof Error?err.message:'Could not load sessions.');}finally{setBusy(false);}}}}>{open?'Hide session planning':'Plan academic year'}</Button>
  </CardHeader>{open&&<CardContent className="space-y-4">
    <p className="text-sm text-stone-500">Rollover preserves the class placements shown below. Use Promotion Review for approved student promotions. Outstanding fees remain payable once; rollover creates no duplicate fee invoice.</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="space-y-1 text-sm">Next session name<input disabled={busy} className={input} maxLength={50} value={name} onChange={event=>{setName(event.target.value);setPreview(null);}} placeholder="2027-2028" /></label>
      <label className="space-y-1 text-sm">Starts<input disabled={busy} type="date" className={input} value={startDate} onChange={event=>{setStart(event.target.value);setPreview(null);}} /></label>
      <label className="space-y-1 text-sm">Ends<input type="date" className={input} value={endDate} onChange={event=>{setEnd(event.target.value);setPreview(null);}} /></label>
    </div>
    <Button disabled={busy||!name.trim()||!startDate||!endDate} onClick={()=>run(false)}>{busy?'Working...':'Preview rollover'}</Button>
    {preview&&<div className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm">Current session: <strong>{preview.current?.name ?? 'Not set'}</strong> / Active students: <strong>{preview.students}</strong> / Existing outstanding fees: <strong>PKR {preview.carryForwardBalance.toLocaleString()}</strong></p>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="p-2">Class</th><th className="p-2">Section</th><th className="p-2">Students</th></tr></thead><tbody>{preview.classes.map(row=><tr key={row.classId+':'+row.sectionId}><td className="p-2">{row.className}</td><td className="p-2">{row.sectionName ?? 'Add a section before enrolling students'}</td><td className="p-2">{row.students}</td></tr>)}</tbody></table></div>
      <Button disabled={busy} onClick={()=>setConfirm(true)}>{preview.current?'Close current session and open next':'Start academic session'}</Button>
    </div>}
    {sessions.length>0&&<div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-stone-50"><tr><th className="p-2">Session</th><th className="p-2">Dates</th><th className="p-2">State</th><th className="p-2">Archive</th></tr></thead><tbody>{sessions.map(row=><tr key={row.id} className="border-b"><td className="p-2">{row.name}</td><td className="p-2">{row.startDate} to {row.endDate}</td><td className="p-2">{row.isCurrent?'Current':row.record.closedAt?'Closed':'Previous'}</td><td className="p-2"><Button size="sm" variant="outline" disabled={busy||!row.record.archivedStudents} onClick={()=>archive(row.id)}>Export preserved roster</Button></td></tr>)}</tbody></table></div>}
    {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
  </CardContent>}{error&&<p role="alert" className="px-6 pb-4 text-sm text-red-800">{error}</p>}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Activate {name}?</DialogTitle><DialogDescription>The current session roster will be preserved and the next session activated. Class placements and invoices stay as reviewed. This action does not promote students or write off unpaid fees.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button><Button disabled={busy||!preview} onClick={()=>run(true)}>Confirm rollover</Button></div></DialogContent></Dialog>
  </Card>;
}
