"use client";
import { ActionForm } from '@/components/ui/action-form';

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { displaySectionName } from "@/lib/class-section-label";

interface ClassOption { id: number; name: string }
interface SectionOption { id: number; classId: number; name: string }
interface CampusOption { id: number; name: string }

export function AnnouncementFormClient({
  campuses,
  classes,
  sections,
  action
}: {
  campuses: CampusOption[];
  classes: ClassOption[];
  sections: SectionOption[];
  action: (formData: FormData) => Promise<unknown>;
}) {
  const [targetType, setTargetType] = useState<string>("ALL");
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const filteredSections = selectedClassId
    ? sections.filter(s => s.classId === parseInt(selectedClassId) && displaySectionName(s.name))
    : [];

  return (
    <Card>
      <CardHeader className="border-b border-border bg-stone-50/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand-600" />
          New Broadcast
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ActionForm action={action} className="space-y-4 pt-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Message Title</label>
            <input
              type="text"
              name="title"
              required
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Holiday Notice"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Target Audience</label>
            <select
              name="targetType"
              required
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                setSelectedCampusId("");
                setSelectedClassId("");
                setSelectedSectionId("");
              }}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="ALL">Everyone</option>
              <option value="STAFF">Staff Only</option>
              <option value="CAMPUS">Specific Campus</option>
              <option value="CLASS">Specific Class</option>
              <option value="SECTION">Specific Section</option>
            </select>
          </div>

          {targetType === "CAMPUS" && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Campus</label>
              <select
                name="targetCampusId"
                required
                value={selectedCampusId}
                onChange={(e) => setSelectedCampusId(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choose Campus...</option>
                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {(targetType === "CLASS" || targetType === "SECTION") && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Class</label>
              <select
                name="targetClassId"
                required
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedSectionId("");
                }}
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choose Class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {targetType === "SECTION" && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Section</label>
              <select
                name="targetSectionId"
                required
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choose Section...</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{displaySectionName(s.name)}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Message Content</label>
            <textarea
              name="content"
              required
              rows={4}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Type your message here..."
            />
          </div>
          <label className="block space-y-1 text-sm">Response requested<select name="responseMode" className="w-full rounded-md border border-border bg-white px-3 py-2"><option value="NONE">Read receipt only</option><option value="ACKNOWLEDGE">Explicit acknowledgement</option><option value="CONSENT">Parent consent (yes / no)</option></select></label>
          <label className="block space-y-1 text-sm">Response deadline (optional)<input type="date" name="responseDeadline" className="w-full rounded-md border border-border px-3 py-2"/></label>
          <p className="text-xs text-stone-500">Opening a notice records a read receipt only. Parent consent needs an explicit response for each child.</p>
          <SubmitButton
            className="w-full bg-brand-800 text-white rounded-md py-2 text-sm font-medium hover:bg-brand-900 transition-colors"
          >
            Send Announcement
          </SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

export function AnnouncementReceipts({id}:{id:number}){
  const [data,setData]=useState<{studentRecipients:number;studentReads:number;parents:Array<{parentId:number;name:string;studentId:number;student:string;readAt:string|null;response:{answer:string;at:string}|null}>}|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[limit,setLimit]=useState(100);
  return <div className="mt-2 space-y-2"><button type="button" disabled={busy} className="text-xs font-medium text-brand-700 underline" onClick={async()=>{
    if(data){setData(null);return;}setBusy(true);setError('');
    try{const response=await fetch('/api/institution/announcements?id='+id,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);}catch(err){setError(err instanceof Error?err.message:'Could not load receipts.');}finally{setBusy(false);}
  }}>{busy?'Loading...':data?'Hide receipts':'Read receipts / parent responses'}</button>
  {data&&<div className="space-y-2"><p className="text-xs">{data.studentReads}/{data.studentRecipients} student reads / {data.parents.filter(row=>row.readAt).length}/{data.parents.length} parent-child reads / {data.parents.filter(row=>row.response).length} explicit responses</p>
    <div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-1">Parent</th><th className="p-1">Child</th><th className="p-1">Read</th><th className="p-1">Response</th></tr></thead><tbody>{data.parents.slice(0,limit).map(row=><tr key={row.parentId+':'+row.studentId}><td className="p-1">{row.name}</td><td className="p-1">{row.student}</td><td className="p-1">{row.readAt?new Date(row.readAt).toLocaleString():'Not yet'}</td><td className="p-1">{row.response?row.response.answer+' / '+new Date(row.response.at).toLocaleString():'Awaiting response'}</td></tr>)}</tbody></table></div>
    {data.parents.length>limit&&<button className="text-xs text-brand-700 underline" onClick={()=>setLimit(value=>value+100)}>Show more</button>}
  </div>}{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
