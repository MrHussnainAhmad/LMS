"use client";

import { useEffect, useId, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, ClipboardCheck, Download, Loader2, SlidersHorizontal, TrendingDown, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pakistanDateKey } from '@/lib/parent-period';
import type { StudentSupportRecord } from '@/db/schema';

type Column={key:string;label:string};
type Metadata={datasets:Array<{id:string;label:string;columns:Column[]}>;classes:Array<{id:number;name:string}>;sections:Array<{id:number;classId:number;name:string}>;staff:Array<{id:number;name:string}>};
type Report={columns:Column[];rows:Array<Record<string,unknown>>;total:number;page:number;pages:number;from:string;to:string};
type Saved={name:string;dataset:string;columns:string[];from:string;to:string;classId:string;sectionId:string;q:string;risk:string;status:string;overdue:boolean};
const input='block min-h-10 min-w-0 rounded-md border border-border bg-stone-50/60 px-3 py-2 text-sm font-normal text-brand-950 outline-none transition-colors placeholder:text-stone-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/10 disabled:opacity-60';

export function InstitutionReports({actorKey,compact=false,readOnly=false}:{actorKey:string;compact?:boolean;readOnly?:boolean}){
  const panelId = useId();
  const [expanded,setExpanded]=useState(!compact),[meta,setMeta]=useState<Metadata|null>(null);
  const [dataset,setDataset]=useState(compact?'SUPPORT':'STUDENTS'),[columns,setColumns]=useState<string[]>([]);
  const [to,setTo]=useState(pakistanDateKey()),[from,setFrom]=useState(()=>new Date(new Date(pakistanDateKey()+'T12:00:00Z').getTime()-29*86400000).toISOString().slice(0,10));
  const [classId,setClass]=useState(''),[sectionId,setSection]=useState(''),[q,setQuery]=useState('');
  const [risk,setRisk]=useState('ALL'),[status,setStatus]=useState(compact?'ACTIVE':'ALL'),[overdue,setOverdue]=useState(false);
  const [data,setData]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [saved,setSaved]=useState<Saved[]>([]),[saveName,setSaveName]=useState('');
  const [student,setStudent]=useState<{id:number;name:string;record:StudentSupportRecord}|null>(null);
  const storageKey='institution-report-views:'+actorKey;
  useEffect(()=>{
    if(!expanded)return;
    const controller=new AbortController();
    fetch('/api/institution/reports?view=metadata',{signal:controller.signal,cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);return result as Metadata;})
      .then(result=>{if(controller.signal.aborted)return;setMeta(result);setColumns(result.datasets.find(item=>item.id===(compact?'SUPPORT':'STUDENTS'))?.columns.map(item=>item.key)??[]);try{const items=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(items))setSaved(items.filter(item=>item&&typeof item.name==='string'&&result.datasets.some(def=>def.id===item.dataset)&&Array.isArray(item.columns)).slice(0,10));}catch{setSaved([]);}})
      .catch(err=>{if(!controller.signal.aborted)setError(err.message);});
    return()=>controller.abort();
  },[expanded,compact,storageKey]);
  const run=async(page=1,exportCsv=false)=>{
    setBusy(true);setError('');
    try{
      const params=new URLSearchParams({dataset,from,to,page:String(page),columns:columns.join(','),risk,status,q});
      if(classId)params.set('classId',classId);if(sectionId)params.set('sectionId',sectionId);if(overdue)params.set('overdue','1');if(exportCsv)params.set('format','csv');
      const response=await fetch('/api/institution/reports?'+params,{cache:'no-store'});
      if(!response.ok){const result=await response.json();throw new Error(result.error||'Could not load the report.');}
      if(exportCsv){const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='institution-'+dataset.toLowerCase()+'.csv';link.click();URL.revokeObjectURL(url);}
      else setData(await response.json());
    }catch(err){setError(err instanceof Error?err.message:'Could not load the report.');}finally{setBusy(false);}
  };
  const saveView=()=>{
    const name=saveName.trim();if(!name)return;
    const next=[...saved.filter(row=>row.name!==name),{name,dataset,columns,from,to,classId,sectionId,q,risk,status,overdue}].slice(-10);
    try{localStorage.setItem(storageKey,JSON.stringify(next));setSaved(next);setSaveName('');}catch{setError('Could not save this view on this browser.');}
  };
  return <Card className="overflow-hidden"><CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-brand-200 bg-brand-50"><ClipboardCheck aria-hidden="true" className="h-5 w-5 text-brand-700"/></span><div className="min-w-0"><CardTitle className="text-base">{compact?'Student support':'Custom reports'}</CardTitle><CardDescription className="mt-1 max-w-2xl text-xs leading-5">{compact?'A clear view of students who may need a little extra attention.':'Choose the information you need, save your preferences, and export reports.'}</CardDescription></div></div>{compact&&<Button type="button" size="sm" variant="outline" aria-expanded={expanded} aria-controls={panelId} className="shrink-0 self-start sm:self-center" onClick={()=>setExpanded(value=>!value)}>{expanded?'Close support':'View student support'}{expanded?<ChevronUp aria-hidden="true" className="ml-2 h-4 w-4"/>:<ChevronDown aria-hidden="true" className="ml-2 h-4 w-4"/>}</Button>}</CardHeader>
    {compact&&<div className="grid border-t border-border bg-stone-50/50 sm:grid-cols-3">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:px-6"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"/><div><p className="text-xs font-semibold text-brand-950">Attendance</p><p className="mt-1 text-xs leading-5 text-stone-500">3 or more absences in the selected period</p></div></div>
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:px-6"><TrendingDown aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"/><div><p className="text-xs font-semibold text-brand-950">Academic progress</p><p className="mt-1 text-xs leading-5 text-stone-500">Assessment average down by 10 points</p></div></div>
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6"><WalletCards aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"/><div><p className="text-xs font-semibold text-brand-950">Fee follow-up</p><p className="mt-1 text-xs leading-5 text-stone-500">Unpaid fees past their payment deadline</p></div></div>
    </div>}
    {expanded&&<CardContent id={panelId} className="space-y-5 border-t border-border pt-5 sm:pt-6">
      {!meta&&<p role="status" className="text-sm text-stone-500">Loading report options...</p>}
      {meta&&<>
        <form className="space-y-4" onChange={()=>setData(null)} onSubmit={event=>{event.preventDefault();void run();}}><fieldset disabled={busy} className="space-y-4">
          <legend className="mb-4 flex items-center gap-2 text-xs font-semibold text-brand-950"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-brand-600"/>{compact?'Find students to follow up with':'Report filters'}</legend>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!compact&&<label className="block space-y-1.5 text-xs font-medium text-stone-600">Report<select className={input+' w-full'} value={dataset} onChange={event=>{setDataset(event.target.value);setColumns(meta.datasets.find(item=>item.id===event.target.value)?.columns.map(item=>item.key)??[]);}}>{meta.datasets.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
            <label className="block space-y-1.5 text-xs font-medium text-stone-600">Class<select className={input+' w-full'} value={classId} onChange={event=>{setClass(event.target.value);setSection('');}}><option value="">All classes</option>{meta.classes.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="block space-y-1.5 text-xs font-medium text-stone-600">Section<select className={input+' w-full'} value={sectionId} onChange={event=>setSection(event.target.value)}><option value="">All sections</option>{meta.sections.filter(row=>!classId||row.classId===Number(classId)).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            {!['STUDENTS','FEES'].includes(dataset)&&<><label className="block space-y-1.5 text-xs font-medium text-stone-600">From<input type="date" className={input+' w-full'} value={from} onChange={event=>setFrom(event.target.value)}/></label>
            <label className="block space-y-1.5 text-xs font-medium text-stone-600">Through<input type="date" className={input+' w-full'} value={to} onChange={event=>setTo(event.target.value)}/></label></>}
            <label className="block space-y-1.5 text-xs font-medium text-stone-600">Student name or login ID<input className={input+' w-full'} maxLength={80} value={q} onChange={event=>setQuery(event.target.value)}/></label>
            {dataset==='SUPPORT'&&<><label className="block space-y-1.5 text-xs font-medium text-stone-600">Support signal<select className={input+' w-full'} value={risk} onChange={event=>setRisk(event.target.value)}><option value="ALL">Any support signal</option><option value="ABSENCES">3 or more absences</option><option value="MARKS">Assessment average fell 10 points</option><option value="FEES">Overdue fees</option></select></label><label className="block space-y-1.5 text-xs font-medium text-stone-600">Follow-up state<select className={input+' w-full'} value={status} onChange={event=>setStatus(event.target.value)}>{['ACTIVE','ALL','OPEN','MONITORING','RESOLVED'].map(value=><option key={value} value={value}>{value==='ACTIVE'?'Open and monitoring':value}</option>)}</select></label></>}
            {dataset==='FEES'&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdue} onChange={event=>setOverdue(event.target.checked)}/>Overdue only (all billing months)</label>}
          </div>
          <details className="rounded-md border border-border bg-stone-50/40 p-3"><summary className="cursor-pointer text-xs font-medium text-stone-600">Visible columns <span className="ml-1 text-stone-400">({columns.length})</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meta.datasets.find(item=>item.id===dataset)?.columns.map(column=><label key={column.key} className="flex items-center gap-2 text-xs text-stone-600"><input className="h-3.5 w-3.5 accent-brand-700" type="checkbox" checked={columns.includes(column.key)} onChange={event=>setColumns(previous=>event.target.checked?[...previous,column.key]:previous.filter(key=>key!==column.key))}/>{column.label}</label>)}</div></details>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4"><Button disabled={busy||!columns.length}>{busy&&<Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin"/>}{busy?'Loading...':compact?'Find students':'Run report'}</Button><Button type="button" variant="outline" disabled={busy||!columns.length} onClick={()=>run(1,true)}><Download aria-hidden="true" className="mr-2 h-4 w-4"/>Export CSV</Button></div>
        </fieldset></form>
        {dataset==='SUPPORT'&&<p className="text-xs text-stone-500">Signals use the selected attendance period, the same-length previous period of published assessment marks, and currently overdue invoices. Missing marks are not counted as zero. These signals help staff decide whom to contact.</p>}
        {dataset==='FEES'&&<p className="text-xs text-stone-500">Fee reports include the existing ledger across every billing month; they preserve class-at-issue labels and respect installment due dates.</p>}
        {!compact&&<div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"><label className="text-xs">Saved views (this browser)<select disabled={busy} className={input+' ml-2'} defaultValue="" onChange={event=>{const value=saved.find(row=>row.name===event.target.value);if(!value)return;setDataset(value.dataset);setColumns(value.columns);setFrom(value.from);setTo(value.to);setClass(value.classId);setSection(value.sectionId);setQuery(value.q);setRisk(value.risk);setStatus(value.status);setOverdue(value.overdue);setData(null);}}><option value="">Choose saved view</option>{saved.map(row=><option key={row.name} value={row.name}>{row.name}</option>)}</select></label><input aria-label="Report view name" className={input} maxLength={60} value={saveName} onChange={event=>setSaveName(event.target.value)} placeholder="View name"/><Button size="sm" variant="outline" disabled={busy||!saveName.trim()} onClick={saveView}>Save current view</Button><Button size="sm" variant="ghost" disabled={busy||!saved.length} onClick={()=>{try{localStorage.removeItem(storageKey);setSaved([]);}catch{setError('Could not clear saved views.');}}}>Clear saved views</Button></div>}
      </>}
      {error&&<p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {data&&<><p className="text-xs text-stone-500">{data.total} matching records / Page {data.page} of {data.pages}</p><div className="overflow-auto rounded-md border border-border"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500"><tr>{data.columns.map(column=><th key={column.key} className="whitespace-nowrap px-4 py-3">{column.label}</th>)}{dataset==='SUPPORT'&&!readOnly&&<th className="px-4 py-3">Action</th>}</tr></thead><tbody className="divide-y divide-border">
        {data.rows.map((row,index)=><tr key={index} className="transition-colors hover:bg-stone-50/70">{data.columns.map(column=><td key={column.key} className="max-w-80 break-words px-4 py-3 text-xs leading-5 text-stone-600">{row[column.key]===null||row[column.key]===undefined?'--':String(row[column.key])}</td>)}{dataset==='SUPPORT'&&!readOnly&&<td className="px-4 py-3"><Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const response=await fetch('/api/institution/students/'+row._id,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error);setStudent({id:Number(row._id),name:result.student.name,record:result.student.supportRecord??{}});}catch(err){setError(err instanceof Error?err.message:'Could not open follow-up.');}finally{setBusy(false);}}}>Follow up</Button></td>}</tr>)}
      </tbody></table></div>{!data.rows.length&&<p className="text-sm text-stone-500">No matching records.</p>}<div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy||data.page<=1} onClick={()=>run(data.page-1)}>Previous</Button><Button size="sm" variant="outline" disabled={busy||data.page>=data.pages} onClick={()=>run(data.page+1)}>Next</Button></div></>}
    </CardContent>}
    {student&&meta&&<SupportFollowUpForm key={student.id} student={student} staff={meta.staff} onClose={()=>setStudent(null)} onSaved={async()=>{setStudent(null);await run(data?.page??1);}}/>}
  </Card>;
}

function SupportFollowUpForm({student,staff,onClose,onSaved}:{student:{id:number;name:string;record:StudentSupportRecord};staff:Array<{id:number;name:string}>;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('');
    try{const response=await fetch('/api/institution/students/'+student.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'supportFollowUp',revision:student.record.revision??0,status:form.get('status'),assignedTo:form.get('assignedTo')?Number(form.get('assignedTo')):null,nextDate:form.get('nextDate')||null,note:form.get('note')})}),result=await response.json();if(!response.ok)throw new Error(result.error);await onSaved();}
    catch(err){setError(err instanceof Error?err.message:'Could not save follow-up.');}finally{setBusy(false);}
  };
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>Follow up: {student.name}</DialogTitle><DialogDescription>Record the action taken and the next contact. Risk signals remain visible until the case is resolved.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-3">
    <label className="block space-y-1.5 text-xs font-medium text-stone-600">State<select name="status" className={input+' w-full'} defaultValue={student.record.status??'OPEN'}>{['OPEN','MONITORING','RESOLVED'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <label className="block space-y-1.5 text-xs font-medium text-stone-600">Assigned staff<select name="assignedTo" className={input+' w-full'} defaultValue={student.record.assignedTo??''}><option value="">Institution team</option>{staff.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label className="block space-y-1.5 text-xs font-medium text-stone-600">Next follow-up<input name="nextDate" type="date" min={pakistanDateKey()} className={input+' w-full'} defaultValue={student.record.nextDate??''}/></label>
    <label className="block space-y-1.5 text-xs font-medium text-stone-600">Action note<textarea name="note" required minLength={5} maxLength={1000} className={input+' w-full'} placeholder="What was discussed, decided, or resolved?"/></label>
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}<Button disabled={busy}>Save follow-up</Button>
  </form>{student.record.history?.slice().reverse().map((row,index)=><p key={index} className="rounded-md bg-stone-50 p-2 text-xs">{new Date(row.at).toLocaleString()} / {row.status} / {row.note}</p>)}</DialogContent></Dialog>;
}
