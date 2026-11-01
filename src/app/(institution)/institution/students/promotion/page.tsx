"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Batch = { id: number; title: string; className: string; sectionName: string | null; officialPublishedAt: string | null; promotionAppliedAt: string | null; version: number };

export default function PromotionPage() {
  const [batches, setBatches] = useState<Batch[]>([]), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Batch | null>(null), [reviewed, setReviewed] = useState(false);
  const load = async () => {
    const response = await fetch('/api/institution/students/auto-promote', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load promotion exams.');
    setBatches(data.batches); setLoaded(true);
  };
  const refresh = async () => { setBusy(true); setMessage(''); try { await load(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not load exams.'); } finally { setBusy(false); } };
  const apply = async () => {
    if (!selected || !reviewed) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/institution/students/auto-promote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchExamId: selected.id, version: selected.version, confirm: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Promotion failed.');
      setMessage(`${data.result.promotedCount} promoted, ${data.result.retainedCount} retained, ${data.result.graduatedCount} graduated.`);
      setSelected(null); await load();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Promotion failed.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-brand-950">Promotion review</h1><p className="mt-1 text-sm text-stone-500">Publish approved results in Exams first. Review the report before moving students to the next class.</p></div><Button variant="outline" onClick={refresh} disabled={busy}>{busy ? 'Loading...' : loaded ? 'Refresh' : 'Load promotion results'}</Button></div>
    {message && <p role="status" className="rounded-md border border-border bg-white p-3 text-sm">{message}</p>}
    {!loaded && <Card><CardContent className="p-6 text-sm text-stone-500">Load promotion results to review published exams and class movements.</CardContent></Card>}
    {loaded && !batches.length && <p className="text-sm text-stone-500">No promotion exams yet. Create an exam with the Promotion type in Exams.</p>}
    {batches.map(batch => <Card key={batch.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold">{batch.title}</h2><p className="text-sm text-stone-500">{batch.className}{batch.sectionName ? ` / ${batch.sectionName}` : ''} / Version {batch.version}</p><p className="mt-1 text-xs text-brand-800">{batch.promotionAppliedAt ? 'Promotion applied' : batch.officialPublishedAt ? 'Published / awaiting promotion review' : 'Publish results in Exams first'}</p></div>
      <div className="flex gap-2"><Button variant="outline" asChild><a href={`/institution/students/promotion/${batch.id}`} target="_blank" rel="noreferrer">Review report</a></Button><Button disabled={busy || !batch.officialPublishedAt || Boolean(batch.promotionAppliedAt)} onClick={() => { setSelected(batch); setReviewed(false); }}>Review promotion</Button></div>
    </CardContent></Card>)}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!busy && !open) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>Apply promotion for {selected?.title}?</DialogTitle><DialogDescription>Passing students move to the next class, or graduate from the final class. Failed students remain. Class roll numbers may change. The reviewed report version is locked after this action.</DialogDescription></DialogHeader>
      {selected && <Button variant="outline" asChild><a href={`/institution/students/promotion/${selected.id}?version=${selected.version}`} target="_blank" rel="noreferrer">Open report version {selected.version}</a></Button>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1" />I reviewed this report and confirm these class movements.</label>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button disabled={busy || !reviewed} onClick={apply}>{busy ? 'Applying...' : 'Apply reviewed promotion'}</Button></div>
    </DialogContent></Dialog>
  </div>;
}
