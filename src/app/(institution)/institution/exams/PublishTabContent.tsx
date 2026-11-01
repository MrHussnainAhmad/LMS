"use client";

import { useCallback, useEffect, useState } from 'react';
import { PublishResultsForm } from '@/components/institution/PublishResultsForm';
import { BatchMarksSheet, type MarksSheetData } from '@/components/institution/BatchMarksSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Batch = { id: number; title: string; classId: number; className: string; sectionName: string | null;
  officialPublishedAt: string | null; expected: number; completed: number; allSubjectsPublished: boolean; settings: { phase?: string } };
type Report = Omit<MarksSheetData, 'subjects'> & {
  exam: MarksSheetData['exam'] & { classId: number };
  comparison?: { title: string; version: number; students: Array<{ id: number; name: string; previous: number; current: number; change: number }> };
  ready: boolean; statistics: { students: number; passed: number; failed: number; pending: number; average: number; highest: number };
  subjects: Array<MarksSheetData['subjects'][number] & { average: number | null; failing: number; overdue: boolean; staffId: number | null; staffName: string | null }>;
};

export function PublishTabContent({ active, classes, subjects }: {
  active: boolean; classes: Array<{id: number; name: string; level: number}>;
  subjects: Array<{id: number; name: string; code: string | null}>;
}) {
  const [sections, setSections] = useState<Array<{id: number; classId: number; name: string}>>([]);
  const [batches, setBatches] = useState<Batch[]>([]), [selected, setSelected] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null), [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [error, setError] = useState(''), [confirmPublish, setConfirmPublish] = useState(false);
  const [comparisonId, setComparisonId] = useState(''), [comparisonPage, setComparisonPage] = useState(0);

  const load = useCallback(async (id?: number | null) => {
    const chosen = id === undefined ? selected : id;
    const response = await fetch(chosen ? `/api/institution/batch-exams?id=${chosen}` : '/api/institution/batch-exams', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load results.');
    if (chosen) setReport(data); else setBatches(data.batches);
  }, [selected]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    Promise.all([
      fetch('/api/institution/sections', { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error('Could not load sections.'); return response.json(); }),
      fetch('/api/institution/batch-exams', { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error('Could not load exams.'); return response.json(); }),
    ]).then(([sectionData, batchData]) => { setSections(sectionData.sections ?? []); setBatches(batchData.batches); setError(''); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active]);
  const open = async (id: number) => {
    setLoading(true); setError('');
    try { await load(id); setSelected(id); setCreating(false); setComparisonId(''); setComparisonPage(0); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open exam.'); }
    finally { setLoading(false); }
  };
  const action = async (name: string, subjectId?: number) => {
    if (!report || dirty) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/institution/batch-exams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.exam.id, action: name, subjectId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not complete action.');
      setConfirmPublish(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not complete action.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-brand-950">Exams and results</h2><p className="text-sm text-stone-500">Draft / subject review / institution approval / published</p></div>
      {selected || creating ? <Button variant="outline" disabled={dirty || busy} onClick={async () => { setSelected(null); setReport(null); setCreating(false); try { await load(null); } catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh.'); } }}>Back to exams</Button>
        : <Button disabled={loading} onClick={() => setCreating(true)}>Create exam</Button>}
    </div>
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading && <p role="status" className="p-4 text-sm text-stone-500">Loading exams...</p>}
    {creating && <PublishResultsForm classes={classes} sections={sections} subjects={subjects} batches={batches} onCreated={open} />}
    {!creating && !selected && !loading && <div className="grid gap-4 lg:grid-cols-2">
      {!batches.length && <Card><CardContent className="p-6 text-sm text-stone-500">Create your first exam draft to enter or import marks.</CardContent></Card>}
      {batches.map(batch => <Card key={batch.id}><CardContent className="space-y-3 p-5">
        <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{batch.title}</h3><p className="text-sm text-stone-500">{batch.className}{batch.sectionName ? ` / ${batch.sectionName}` : ''}</p></div><span className="h-fit rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-800">{batch.officialPublishedAt ? 'Published' : batch.allSubjectsPublished ? 'Ready for approval' : batch.settings.phase === 'REVIEW' ? 'Under review' : 'Draft'}</span></div>
        <progress className="h-2 w-full accent-brand-600" max={Math.max(batch.expected, 1)} value={batch.completed} aria-label="Marks completion" />
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-stone-500">{batch.completed} / {batch.expected} result entries completed</p><Button size="sm" variant="outline" onClick={() => open(batch.id)}>Open results</Button></div>
      </CardContent></Card>)}
    </div>}
    {!creating && selected && report && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{report.exam.title} <span className="text-sm font-normal text-stone-500"> / {report.exam.officialPublishedAt ? `Published / v${report.version}` : 'Private draft'}</span></h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><a href={`/institution/students/promotion/${selected}`} target="_blank" rel="noreferrer">Review / print / export</a></Button>
          {!report.exam.officialPublishedAt && <><Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => action('REVIEW')}>{report.exam.settings.phase === 'REVIEW' ? 'Extend review window' : 'Send for teacher review'}</Button><Button size="sm" disabled={busy || dirty || !report.ready} onClick={() => setConfirmPublish(true)}>Approve and publish</Button></>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Students', report.statistics.students],['Passed / Failed', `${report.statistics.passed} / ${report.statistics.failed}`],['Pending / withheld', report.statistics.pending],['Average', `${report.statistics.average}%`]].map(([label,value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}
      </div>
      <Card><CardContent className="overflow-auto p-0"><table className="w-full text-left text-sm"><thead className="border-b bg-stone-50"><tr>{['Subject / Reviewer','Completion','Average','Below subject pass','Review'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {report.subjects.map(subject => <tr key={subject.id}><td className="p-3">{subject.name}<p className="text-xs text-stone-500">{subject.staffId ? subject.staffName ?? 'Assigned teacher' : 'Institution reviewer'}</p></td><td className="p-3">{subject.completed}/{subject.expected}{subject.overdue && !subject.reviewed && <p className="text-xs text-amber-700">Review overdue</p>}</td><td className="p-3">{subject.average === null ? '-' : `${subject.average}%`}</td><td className="p-3">{subject.failing}</td><td className="p-3">{report.exam.officialPublishedAt ? 'Approved' : <Button size="sm" variant="outline" disabled={busy || dirty || (!subject.reviewed && subject.completed !== subject.expected)} onClick={() => action(subject.reviewed ? 'REOPEN_SUBJECT' : 'REVIEW_SUBJECT', subject.id)}>{subject.reviewed ? 'Reopen review' : 'Mark reviewed'}</Button>}</td></tr>)}
      </tbody></table></CardContent></Card>
      {dirty && <p className="text-sm text-amber-800">Save or discard your marks edits before leaving this exam or changing its review status.</p>}
      <BatchMarksSheet key={report.exam.id} data={report} onSaved={load} onDirty={setDirty} />
      <Card><CardContent className="space-y-3 p-4">
        <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Student progress compared with
          <select aria-label="Compare earlier exam" className="rounded-md border border-border bg-white px-3 py-2 text-sm" value={comparisonId} disabled={busy || dirty} onChange={async event => {
            const value = event.target.value; setBusy(true); setError('');
            try {
              const response = await fetch(`/api/institution/batch-exams?id=${selected}${value ? `&compare=${value}` : ''}`, { cache: 'no-store' });
              const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not compare exams.');
              setReport(data); setComparisonId(value); setComparisonPage(0);
            } catch (err) { setError(err instanceof Error ? err.message : 'Could not compare exams.'); } finally { setBusy(false); }
          }}>
            <option value="">Select a published exam</option>{batches.filter(batch => batch.id !== selected && batch.classId === report.exam.classId && batch.officialPublishedAt).map(batch => <option key={batch.id} value={batch.id}>{batch.title}</option>)}
          </select>
        </label>
        {report.comparison && <><p className="text-xs text-stone-500">Compared with {report.comparison.title}, version {report.comparison.version}. Only students with complete results in both exams are included.</p>
          <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-stone-50"><tr><th className="p-2">Student</th><th className="p-2">Earlier</th><th className="p-2">Current</th><th className="p-2">Change (points)</th></tr></thead><tbody className="divide-y divide-border">{report.comparison.students.slice(comparisonPage * 100, (comparisonPage + 1) * 100).map(student => <tr key={student.id}><td className="p-2">{student.name}</td><td className="p-2">{student.previous}%</td><td className="p-2">{student.current}%</td><td className="p-2">{student.change > 0 ? '+' : ''}{student.change}</td></tr>)}</tbody></table></div>
          {!report.comparison.students.length && <p className="text-sm text-stone-500">No completed results to compare yet.</p>}
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!comparisonPage} onClick={() => setComparisonPage(previous => previous - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={(comparisonPage + 1) * 100 >= report.comparison.students.length} onClick={() => setComparisonPage(previous => previous + 1)}>Next</Button></div>
        </>}
      </CardContent></Card>
      <Dialog open={confirmPublish} onOpenChange={setConfirmPublish}><DialogContent><DialogHeader><DialogTitle>Publish {report.exam.title}?</DialogTitle><DialogDescription>Students and parents will receive access to the approved results. Later corrections require a reason and create a report version. Class promotion is a separate action.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmPublish(false)}>Cancel</Button><Button disabled={busy || dirty || !report.ready} onClick={() => action('PUBLISH')}>{busy ? 'Publishing...' : 'Approve and publish'}</Button></div></DialogContent></Dialog>
    </>}
  </div>;
}
