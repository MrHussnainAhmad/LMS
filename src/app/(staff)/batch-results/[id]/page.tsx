"use client";

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BatchMarksSheet, type MarksSheetData } from '@/components/institution/BatchMarksSheet';
import { Button } from '@/components/ui/button';

export default function BatchResultDetailsPage({ params }: { params: Promise<{id: string}> }) {
  const { id } = use(params);
  const [data, setData] = useState<MarksSheetData | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/staff/batch-results/${id}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load subject.');
    setData(body);
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/staff/batch-results/${id}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load subject.'); return body; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id]);
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/staff/batch-results/${id}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not submit review.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit review.'); }
    finally { setBusy(false); }
  };
  const subject = data?.subjects[0];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-brand-950">{subject?.name ?? 'Subject results'}</h1><p className="text-sm text-stone-500">{data?.exam.title}</p></div>
      <div className="flex gap-2">{!dirty && <Button variant="outline" asChild><Link href="/batch-results">Back to results</Link></Button>}<Button disabled={!subject || busy || dirty || subject.reviewed || subject.completed !== subject.expected || Boolean(data?.exam.officialPublishedAt) || new Date(subject.deadline) < new Date()} onClick={submit}>{busy ? 'Submitting...' : subject?.reviewed ? 'Review submitted' : 'Submit subject review'}</Button></div>
    </div>
    <p className="text-sm text-stone-500">Your institution approves publication after reviews are complete. A deadline never publishes marks automatically.</p>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!data && !error && <p role="status" className="text-sm text-stone-500">Loading marks...</p>}
    {data && <BatchMarksSheet key={id} data={data} staffSubjectId={Number(id)} onSaved={load} onDirty={setDirty} />}
  </div>;
}
