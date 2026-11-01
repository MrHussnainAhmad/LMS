"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card';
import { pakistanDateKey } from '@/lib/parent-period';
import type { getStaffWorkload } from '@/lib/timetable-coverage';
type Workload=Awaited<ReturnType<typeof getStaffWorkload>>;
const input='rounded-md border border-border bg-white px-3 py-2 text-sm';

export function StaffWorkloadPanel({readOnly=false}:{readOnly?:boolean}){
  const [date,setDate]=useState(pakistanDateKey()),[data,setData]=useState<Workload|null>(null);
  const [slotId,setSlot]=useState(''),[teacherId,setTeacher]=useState(''),[reason,setReason]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=async()=>{const response=await fetch('/api/institution/timetable?view=workload&date='+date,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load workload.');setData(result);setSlot('');setTeacher('');};
  const slots=data?.slots.filter(row=>row.day===data.day)??[],selected=slots.find(row=>row.id===Number(slotId));
  const save=async()=>{
    if(!selected)return;setBusy(true);setError('');setMessage('');
    try{const response=await fetch('/api/institution/timetable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'teachingCover',assignmentId:selected.id,date,staffId:teacherId?Number(teacherId):null,reason,revision:selected.cover?.revision??0})}),result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save cover.');await load();setReason('');setMessage('Teaching cover saved for this date. Attendance delegation is managed separately.');}
    catch(err){setError(err instanceof Error?err.message:'Could not save cover.');}finally{setBusy(false);}
  };
  return <Card><CardHeader><CardTitle>Staff workload and teaching cover</CardTitle><CardDescription>Review weekly teaching loads, timetable conflicts and the periods needing cover on a selected date.</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-sm">Cover date<input disabled={busy} type="date" className={input+' block'} value={date} onChange={event=>{setDate(event.target.value);setData(null);setSlot('');}}/></label><Button variant="outline" disabled={busy||!date} onClick={async()=>{setBusy(true);setError('');try{await load();}catch(err){setError(err instanceof Error?err.message:'Could not load workload.');}finally{setBusy(false);}}}>{busy?'Loading...':'Load workload'}</Button></div>
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
    {data&&<>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-stone-50"><tr>{['Teacher','Weekly base periods','Minutes','Sections','Cover periods on date','Leave on date'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.staff.map(row=><tr key={row.id}><td className="p-2">{row.name}</td><td className="p-2">{row.periods}</td><td className="p-2">{row.minutes}</td><td className="p-2">{row.sections}</td><td className="p-2">{row.coverPeriods}</td><td className="p-2">{row.onLeave?'Approved leave':'Available'}</td></tr>)}</tbody></table></div>
      {data.conflicts.length>0&&<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-medium">Timetable conflicts ({data.conflicts.length}{data.conflicts.length===200?'+':''})</p>{data.conflicts.map(row=><p key={row.firstId+':'+row.secondId}>Periods #{row.firstId} and #{row.secondId} overlap. Review their section timetables.</p>)}</div>}
      <p className="text-sm">{slots.filter(row=>row.needsCover).length} periods need cover on {date}. Weekly base load stays separate from dated substitutions.</p>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="p-2">Class / Section</th><th className="p-2">Time</th><th className="p-2">Subject</th><th className="p-2">Teacher on date</th><th className="p-2">Cover state</th></tr></thead><tbody className="divide-y divide-border">{slots.map(row=><tr key={row.id}><td className="p-2"><a className="text-brand-700 underline" href={'/institution/timetable?sectionId='+row.sectionId}>{row.className} / {row.sectionName}</a></td><td className="p-2">{row.start.slice(0,5)}-{row.end.slice(0,5)}</td><td className="p-2">{row.subject}</td><td className="p-2">{row.teacher??'Unassigned'}</td><td className="p-2">{row.needsCover?'Needs cover':row.cover?.staffId?'Substitute assigned':'Primary teacher'}</td></tr>)}</tbody></table></div>
      {!slots.length&&<p className="text-sm text-stone-500">No teaching periods on this weekday.</p>}
      {!readOnly&&slots.length>0&&<div className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Period<select className={input+' w-full'} value={slotId} onChange={event=>{setSlot(event.target.value);const row=slots.find(item=>item.id===Number(event.target.value));setTeacher(row?.cover?.staffId?String(row.cover.staffId):'');setReason('');}}><option value="">Choose period</option>{slots.map(row=><option key={row.id} value={row.id}>#{row.id} / {row.className} {row.sectionName} / {row.start.slice(0,5)} / {row.subject}</option>)}</select></label>
        <label className="space-y-1 text-sm">Teacher for this date<select className={input+' w-full'} value={teacherId} onChange={event=>setTeacher(event.target.value)}><option value="">Use primary teacher / clear cover</option>{data.staff.map(row=><option key={row.id} value={row.id} disabled={row.onLeave}>{row.name}{row.onLeave?' (approved leave)':''}</option>)}</select></label>
        <label className="space-y-1 text-sm sm:col-span-2">Reason<input className={input+' w-full'} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><Button disabled={busy||!selected||reason.trim().length<2||date<pakistanDateKey()} onClick={save}>Save teaching cover</Button>
      </div>}
    </>}
  </CardContent></Card>;
}
