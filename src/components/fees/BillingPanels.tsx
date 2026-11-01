"use client";
import { invoiceInstallments } from "@/lib/fee-installments";
import { pakistanDateKey } from "@/lib/parent-period";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Preview = { previewHash: string; eligible: number; alreadyBilled: number; ready: number; zeroTotal: number; totalAmount: number; missingStudents: number; missingAmounts: Array<{classId:number;className:string;headName:string}> };
function Field({ label, children }: {label:string;children:React.ReactNode}) {
  return <label className="block space-y-1.5 text-left text-sm font-medium text-stone-700"><span>{label}</span>{children}</label>;
}
const selectClass = "h-11 w-full rounded-sm border border-border bg-white px-3 text-sm";
export function MonthlyBillingPanel({ month, disabled, onIssued }: {month:string;disabled:boolean;onIssued:(month:string)=>Promise<void>}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const billingMonth = String(form.get("billingMonth"));
    setBusy(true);
    try {
      const result = await api.post<Preview & {created:number}>("/api/institution/fees", {action: preview ? "generateMonth" : "previewMonth", billingMonth, dueDate:form.get("dueDate"), expectedPreviewHash:preview?.previewHash});
      if (!preview) setPreview(result);
      else {
        toast({title: `${result.created} monthly challans created`, variant:"success"});
        setPreview(null);
        await onIssued(billingMonth);
      }
    } catch(error) {
      setPreview(null);
      toast({title:"Billing could not continue",description:error instanceof Error ? error.message : "Please try again.",variant:"destructive"});
    } finally { setBusy(false); }
  }
  return <Card><CardHeader className="border-b bg-stone-50/60"><CardTitle>Monthly challans</CardTitle></CardHeader><CardContent className="p-5">
    <form onSubmit={submit} onChange={()=>setPreview(null)} className="space-y-4">
      <Field label="Billing month"><Input name="billingMonth" type="month" defaultValue={month} required /></Field>
      <Field label="Payment due date"><Input name="dueDate" type="date" required /></Field>
      <p className="text-xs leading-5 text-stone-500">Preview the bill first. Save every class amount explicitly; enter 0 for deliberately free fees. Existing monthly challans are skipped.</p>
      {disabled && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Add a monthly fee head and save its class amounts in Fee structure.</p>}
      {preview && <div className="space-y-3 rounded-md border p-4 text-sm" aria-live="polite">
        <dl className="grid grid-cols-2 gap-3"><div><dt className="text-stone-500">Ready</dt><dd>{preview.ready}</dd></div><div><dt className="text-stone-500">Already billed</dt><dd>{preview.alreadyBilled}</dd></div><div><dt className="text-stone-500">Zero-total challans</dt><dd>{preview.zeroTotal}</dd></div><div><dt className="text-stone-500">Total</dt><dd>PKR {preview.totalAmount.toLocaleString("en-PK")}</dd></div></dl>
        {preview.missingAmounts.length > 0 && <div className="rounded bg-amber-50 p-3 text-amber-900"><p>{preview.missingStudents} students have missing amounts. Billing is blocked until these are saved:</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.missingAmounts.map(row=><li key={`${row.classId}:${row.headName}`}>{row.className} — {row.headName}</li>)}</ul></div>}
        {preview.zeroTotal>0 && <p className="text-stone-500">Zero-total challans are recorded as paid, with no payment received.</p>}
      </div>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || disabled || !!preview && (preview.missingAmounts.length>0 || preview.ready===0)}>{busy ? "Please wait…" : preview ? "Generate previewed challans" : "Preview billing"}</Button>{preview && <Button type="button" variant="outline" disabled={busy} onClick={()=>setPreview(null)}>Refresh preview</Button>}</div>
    </form>
  </CardContent></Card>;
}

type OneTimeInput = {batchId:string;label:string;feeHeadId:number;classId?:number;studentIds?:number[];amount:number;billingMonth:string;dueDate:string};
type BillingStudent = {id:number;name:string;loginRollNumber:string};
export function OneTimeBillingPanel({month,heads,classes,onIssued}:{month:string;heads:Array<{id:number;name:string}>;classes:Array<{id:number;name:string}>;onIssued:(month:string)=>Promise<void>}) {
  const {toast}=useToast();
  const [request,setRequest]=useState<OneTimeInput|null>(null);
  const [batchId,setBatchId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [formElement,setFormElement]=useState<HTMLFormElement|null>(null);
  const [individuals,setIndividuals]=useState(false);
  const [query,setQuery]=useState("");
  const [matches,setMatches]=useState<BillingStudent[]>([]);
  const [selected,setSelected]=useState<BillingStudent[]>([]);
  const [searchError,setSearchError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setSearchError("");
      if(!individuals || query.trim().length<2){setMatches([]);return;}
      try {
        const result=await api.get<{students:BillingStudent[]}>(`/api/institution/students/picker?q=${encodeURIComponent(query.trim())}&limit=8`,{signal:controller.signal});
        if(!controller.signal.aborted)setMatches(result.students);
      } catch {if(!controller.signal.aborted){setMatches([]);setSearchError("Could not search students. Please try again.");}}
    },250);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[individuals,query]);
  function prepare(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=new FormData(event.currentTarget), id=batchId || crypto.randomUUID();
    const target=String(form.get("classId") || "");
    if(target==="students" && !selected.length){toast({title:"Select at least one student",variant:"destructive"});return;}
    setBatchId(id);setFormElement(event.currentTarget);
    setRequest({batchId:id,label:String(form.get("label")),feeHeadId:Number(form.get("feeHeadId")),classId:target && target!=="students" ? Number(target):undefined,studentIds:target==="students" ? selected.map(student=>student.id):undefined,amount:Number(form.get("amount")),billingMonth:String(form.get("billingMonth")),dueDate:String(form.get("dueDate"))});
  }
  async function issue() {
    if(!request)return;
    setBusy(true);
    try {
      const result=await api.post<{created:number;alreadyIssued:boolean}>("/api/institution/fees",{action:"issueOneTime",...request});
      toast({title:result.alreadyIssued ? "These challans were already issued" : `${result.created} one-time challans created`,variant:"success"});
      setRequest(null);setBatchId(null);setIndividuals(false);setSelected([]);setQuery("");formElement?.reset();await onIssued(request.billingMonth);
    } catch(error) {toast({title:"Could not issue one-time challans",description:error instanceof Error ? error.message:"Please try again.",variant:"destructive"});}
    finally {setBusy(false);}
  }
  return <Card className="lg:col-span-2"><CardHeader className="border-b bg-stone-50/60"><CardTitle>One-time event or special charge</CardTitle></CardHeader><CardContent className="p-5">
    <form onSubmit={prepare} onChange={()=>setBatchId(null)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Charge name"><Input name="label" placeholder="Annual trip, examination…" minLength={2} maxLength={120} required /></Field>
        <Field label="One-time fee head"><select name="feeHeadId" className={selectClass} required><option value="">Select a fee head</option>{heads.map(head=><option key={head.id} value={head.id}>{head.name}</option>)}</select></Field>
        <Field label="Students"><select name="classId" className={selectClass} onChange={event=>setIndividuals(event.target.value==="students")}><option value="">All active students</option>{classes.map(row=><option key={row.id} value={row.id}>Class: {row.name}</option>)}<option value="students">Select individual students</option></select></Field>
        <Field label="Amount per student"><Input name="amount" type="number" min={1} max={10000000} required /></Field>
        <Field label="Billing month"><Input name="billingMonth" type="month" defaultValue={month} required /></Field>
        <Field label="Payment due date"><Input name="dueDate" type="date" required /></Field>
      </div>
      {individuals && <div className="space-y-3 rounded-md border p-4">
        <Field label="Find students"><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Student name or roll number" /></Field>
        {searchError && <p role="alert" className="text-sm text-red-700">{searchError}</p>}
        {matches.filter(student=>!selected.some(row=>row.id===student.id)).map(student=><button key={student.id} type="button" className="block w-full rounded border px-3 py-2 text-left text-sm hover:bg-stone-50" onClick={()=>{setSelected(rows=>[...rows,student]);setQuery("");setMatches([]);setBatchId(null);}}><span className="font-medium">{student.name}</span><span className="ml-2 text-xs text-stone-500">{student.loginRollNumber}</span></button>)}
        <p className="text-xs text-stone-500">{selected.length} students selected</p>
        <div className="flex flex-wrap gap-2">{selected.map(student=><Button key={student.id} size="sm" variant="outline" type="button" className="max-w-full whitespace-normal text-left" onClick={()=>{setSelected(rows=>rows.filter(row=>row.id!==student.id));setBatchId(null);}} aria-label={`Remove ${student.name}`}>{student.name} ×</Button>)}</div>
      </div>}
      <p className="text-xs leading-5 text-stone-500">Creates a separate challan alongside monthly tuition. This charge does not repeat next month.</p>
      {!heads.length && <p className="text-sm text-amber-900">Add a One-time fee head in Fee structure first.</p>}
      <Button disabled={busy || !heads.length}>Review one-time charge</Button>
    </form>
    <Dialog open={request!==null} onOpenChange={open=>{if(!open && !busy)setRequest(null);}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Issue one-time challans?</DialogTitle><DialogDescription>Each selected active student receives a separate challan. Existing tuition and payments stay unchanged.</DialogDescription></DialogHeader>
      {request && <dl className="space-y-3 rounded border p-4 text-sm"><div><dt className="text-stone-500">Charge</dt><dd className="break-words font-semibold">{request.label}</dd></div><div><dt className="text-stone-500">Recipients</dt><dd>{request.studentIds ? `${request.studentIds.length} selected students` : request.classId ? classes.find(row=>row.id===request.classId)?.name : "All active students"}</dd></div><div><dt className="text-stone-500">Per student</dt><dd>PKR {request.amount.toLocaleString("en-PK")}</dd></div><div><dt className="text-stone-500">Due date</dt><dd>{request.dueDate}</dd></div></dl>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setRequest(null)}>Cancel</Button><Button disabled={busy} onClick={()=>void issue()}>{busy ? "Issuing…":"Issue challans"}</Button></div>
    </DialogContent></Dialog>
  </CardContent></Card>;
}

export function InvoiceSupportPanel({invoice,onClose,onSaved}:{invoice:{id:number;studentName:string;totalAmount:number;paidAmount:number;plan?:import('@/db/schema').FeeInvoicePlan};onClose:()=>void;onSaved:()=>Promise<void>}) {
  const balance=invoice.totalAmount-invoice.paidAmount;
  const [rows,setRows]=useState(()=>[{dueDate:pakistanDateKey(),amount:Math.floor(balance/2)},{dueDate:new Date(Date.now()+30*86400000).toISOString().slice(0,10),amount:balance-Math.floor(balance/2)}]);
  const [reason,setReason]=useState(''),[note,setNote]=useState(''),[nextDate,setNextDate]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const schedule=invoiceInstallments(invoice);
  const save=async(installments:boolean)=>{
    setBusy(true);setError('');
    try{
      await api.post('/api/institution/fees',installments?{action:'setInstallments',invoiceId:invoice.id,expectedPaidAmount:invoice.paidAmount,revision:invoice.plan?.revision??0,reason,installments:rows}
        :{action:'feeFollowUp',invoiceId:invoice.id,note,nextDate:nextDate||undefined});
      await onSaved();onClose();
    }catch(err){setError(err instanceof Error?err.message:'Could not save invoice changes.');}finally{setBusy(false);}
  };
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-h-[90vh] max-w-2xl overflow-auto"><DialogHeader><DialogTitle>Fee plan and follow-up</DialogTitle><DialogDescription>{invoice.studentName} / Outstanding PKR {balance.toLocaleString()}. A payment plan changes due dates, not the invoice total.</DialogDescription></DialogHeader>
    {schedule.installments.length>0&&<div className="space-y-1 rounded-md border border-border p-3 text-sm">{schedule.installments.map(row=><p key={row.dueDate}>{row.dueDate} / PKR {row.amount.toLocaleString()} / Remaining {row.remaining.toLocaleString()}</p>)}</div>}
    {balance>=2&&<details className="rounded-md border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{schedule.installments.length?'Replace remaining installment schedule':'Create installment schedule'}</summary><div className="mt-3 space-y-3">
      <p className="text-xs text-stone-500">Split only the current outstanding balance. New payments settle the earliest installment first.</p>
      {rows.map((row,index)=><div key={index} className="flex gap-2"><Input type="date" aria-label={'Installment '+(index+1)+' due date'} min={pakistanDateKey()} value={row.dueDate} onChange={event=>setRows(previous=>previous.map((item,position)=>position===index?{...item,dueDate:event.target.value}:item))}/><Input type="number" min={1} aria-label={'Installment '+(index+1)+' amount'} value={row.amount} onChange={event=>setRows(previous=>previous.map((item,position)=>position===index?{...item,amount:Number(event.target.value)}:item))}/><Button variant="outline" size="sm" disabled={rows.length<=2||busy} onClick={()=>setRows(previous=>previous.filter((_,position)=>position!==index))}>Remove</Button></div>)}
      <Button variant="outline" size="sm" disabled={rows.length>=12||busy} onClick={()=>setRows(previous=>[...previous,{dueDate:'',amount:0}])}>Add installment</Button>
      <p className="text-sm">Scheduled total: PKR {rows.reduce((sum,row)=>sum+row.amount,0).toLocaleString()} / Required: {balance.toLocaleString()}</p>
      <label className="block space-y-1 text-sm">Reason<Input maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <Button disabled={busy||reason.trim().length<5||rows.reduce((sum,row)=>sum+row.amount,0)!==balance} onClick={()=>save(true)}>Save installment plan</Button>
    </div></details>}
    <div className="space-y-3 border-t border-border pt-3"><h3 className="text-sm font-semibold">Collection follow-up</h3><label className="block text-sm">Contact note<textarea className="mt-1 w-full rounded-md border border-border p-2" maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/></label><label className="block text-sm">Next contact date (optional)<Input type="date" min={pakistanDateKey()} value={nextDate} onChange={event=>setNextDate(event.target.value)}/></label><Button disabled={busy||note.trim().length<2} onClick={()=>save(false)}>Record follow-up</Button>
      {(invoice.plan?.followUps??[]).slice(-5).reverse().map((row,index)=><p key={index} className="rounded-md bg-stone-50 p-2 text-xs">{new Date(row.at).toLocaleString()} / {row.note}{row.nextDate?' / Next contact: '+row.nextDate:''}</p>)}
    </div>{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
  </DialogContent></Dialog>;
}

export function FamilyDiscountPanel({studentId,month,onSaved}:{studentId:number|null;month:string;onSaved:()=>Promise<void>}) {
  const [amount,setAmount]=useState(''),[endMonth,setEnd]=useState('');
  const [preview,setPreview]=useState<{previewHash:string;family:Array<{id:number;name:string;loginId:string}>}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const run=async(confirm:boolean)=>{
    if(!studentId)return;setBusy(true);setError('');
    try{
      const result=await api.post<{previewHash:string;family:Array<{id:number;name:string;loginId:string}>}>('/api/institution/fees',{action:'siblingDiscount',studentId,amount:Number(amount),startMonth:month,endMonth:endMonth||undefined,confirm,expectedPreviewHash:preview?.previewHash});
      if(confirm){setPreview(null);setAmount('');await onSaved();}else setPreview(result);
    }catch(err){setError(err instanceof Error?err.message:'Could not save family discount.');}finally{setBusy(false);}
  };
  return <div className="space-y-3 rounded-md border border-border p-3"><h3 className="text-sm font-semibold">Recurring sibling discount</h3><p className="text-xs text-stone-500">Select a student above. Preview active siblings linked to the same parent before applying an equal monthly discount to each child.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Sibling discount per child" type="number" min={1} value={amount} placeholder="PKR discount per child" onChange={event=>{setAmount(event.target.value);setPreview(null);}}/><Input aria-label="Sibling discount end month" type="month" min={month} value={endMonth} onChange={event=>{setEnd(event.target.value);setPreview(null);}}/></div>
    {preview&&<p className="text-sm">{preview.family.map(row=>row.name+' ('+row.loginId+')').join(', ')}</p>}
    <Button type="button" variant="outline" disabled={busy||!studentId||!Number(amount)} onClick={()=>run(Boolean(preview))}>{preview?'Confirm discount for listed siblings':'Preview eligible siblings'}</Button>{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}
