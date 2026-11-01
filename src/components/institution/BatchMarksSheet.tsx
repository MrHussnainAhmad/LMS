"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BatchMarkState, BatchSubjectPolicy } from '@/db/schema';

type Entry = BatchMarkState & { id: number; subjectId: number; revision: number; maxMarks: number;
  history?: Array<{ reportVersion: number; reason: string; at: string; before: BatchMarkState }> };
export type MarksSheetData = {
  exam: { id: number; title: string; officialPublishedAt: string | Date | null; settings: { phase?: string; promotionAppliedAt?: string } };
  version: number;
  subjects: Array<{ id: number; name: string; maxMarks: number; policy: BatchSubjectPolicy; reviewed: boolean; deadline: string | Date; expected: number; completed: number }>;
  students: Array<{ id: number; name: string; roll: string; results: Entry[] }>;
};
type Draft = { status: BatchMarkState['status']; marks: string; components: Record<string, string>; remark: string };
const statuses = ['MARKED','ABSENT','EXEMPT','WITHHELD','NOT_ENTERED'] as const;
const input = 'rounded-md border border-border bg-white px-2 py-1.5 text-sm disabled:bg-stone-50 disabled:text-stone-500';

export function BatchMarksSheet({ data, staffSubjectId, onSaved, onDirty }: {
  data: MarksSheetData; staffSubjectId?: number; onSaved: () => Promise<void>; onDirty?: (dirty: boolean) => void;
}) {
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? 0);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [page, setPage] = useState(0), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const grid = useRef<HTMLTableElement>(null);
  const dirty = Object.keys(drafts).length > 0;
  const subject = data.subjects.find(item => item.id === subjectId) ?? data.subjects[0];
  const published = Boolean(data.exam.officialPublishedAt);
  const readOnly = Boolean(data.exam.settings.promotionAppliedAt) || Boolean(staffSubjectId && (published || subject?.reviewed || data.exam.settings.phase === 'DRAFT' || new Date(subject?.deadline ?? 0) < new Date()));
  const visible = data.students.slice(page * 50, (page + 1) * 50);
  const entries = new Map(data.students.flatMap(student => student.results.map(result => [result.id, result] as const)));

  useEffect(() => {
    onDirty?.(dirty);
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, onDirty]);

  const draftFor = (entry: Entry): Draft => drafts[entry.id] ?? {
    status: entry.status, marks: entry.status === 'MARKED' ? String(entry.marks) : '',
    components: Object.fromEntries(Object.entries(entry.components ?? {}).map(([key, value]) => [key, String(value)])), remark: entry.remark ?? '',
  };
  const change = (entry: Entry, patch: Partial<Draft>) => setDrafts(previous => ({ ...previous, [entry.id]: { ...draftFor(entry), ...patch } }));
  const paste = (event: ClipboardEvent<HTMLInputElement>, offset: number) => {
    const text = event.clipboardData.getData('text/plain').replace(/\r/g, '').replace(/\n$/, '');
    const aliases: Record<string, Draft['status']> = { '': 'NOT_ENTERED', AB: 'ABSENT', EX: 'EXEMPT', WH: 'WITHHELD' };
    if (!text.includes('\n') && !text.includes('\t') && !aliases[text.trim().toUpperCase()] && !statuses.includes(text.trim().toUpperCase() as Draft['status'])) return;
    event.preventDefault();
    const lines = text.split('\n');
    if (lines.length > visible.length - offset) { setError('Paste fits within one page (50 students). Change pages for the next group.'); return; }
    const updates: Record<number, Draft> = {};
    for (let index = 0; index < lines.length; index++) {
      const row = visible[offset + index].results.find(item => item.subjectId === subject.id);
      if (!row?.id) { setError('A result row is missing. Reload the sheet.'); return; }
      const fields = lines[index].split('\t').map(value => value.trim());
      const raw = fields[0].toUpperCase();
      const status = aliases[raw] ?? (statuses.includes(raw as Draft['status']) ? raw as Draft['status'] : 'MARKED');
      const components = Object.fromEntries((subject.policy.components ?? []).map((component, position) => [component.name, fields[position + 1] ?? '']));
      updates[row.id] = { ...draftFor(row), status, marks: status === 'MARKED' ? fields[0] : '', components };
    }
    setError(''); setDrafts(previous => ({ ...previous, ...updates }));
  };
  const navigate = (event: KeyboardEvent<HTMLInputElement>, row: number, column: number) => {
    if (!['Enter','ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const next = row + (event.key === 'ArrowUp' ? -1 : 1);
    const nextInput = grid.current?.querySelector<HTMLInputElement>(`[data-row="${next}"][data-col="${column}"]`);
    nextInput?.focus();
    nextInput?.select();
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const changes = Object.entries(drafts).map(([id, draft]) => ({
        resultId: Number(id), revision: entries.get(Number(id))!.revision,
        value: { ...draft, marks: draft.marks, components: draft.components },
      }));
      const response = await fetch(staffSubjectId ? `/api/staff/batch-results/${staffSubjectId}` : '/api/institution/batch-exams', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SAVE', id: data.exam.id, changes, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save marks.');
      setDrafts({}); setReason(''); await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save marks.'); }
    finally { setBusy(false); }
  };
  if (!subject) return <p>No subjects are configured for this exam.</p>;
  return <Card><CardContent className="space-y-4 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="space-y-1 text-sm">Marks sheet<select aria-label="Marks sheet subject" className={`${input} ml-2`} value={subject.id} onChange={event => { setSubjectId(Number(event.target.value)); setPage(0); }}>
        {data.subjects.map(item => <option key={item.id} value={item.id}>{item.name} ({item.completed}/{item.expected})</option>)}
      </select></label>
      <p className="text-xs text-stone-500">Maximum {subject.maxMarks} / {subject.reviewed ? 'Reviewed' : 'Awaiting review'} / Version {data.version}</p>
    </div>
    <p className="text-xs text-stone-500">{readOnly ? 'This sheet is locked. Ask the institution to reopen review when needed.' : 'Enter moves down the column. Paste spreadsheet rows into Marks (total, then component columns). Save before submitting review.'}</p>
    {published && !readOnly && <label className="block space-y-1 text-sm">Required correction reason<input className={`${input} w-full`} maxLength={1000} minLength={10} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why these published marks are changing (at least 10 characters)" /></label>}
    <div className="overflow-auto"><table ref={grid} className="w-full text-left text-sm">
      <thead className="border-b bg-stone-50 text-stone-600"><tr><th className="p-2">Roll / Student</th><th className="p-2">Status</th><th className="p-2">Marks</th>{subject.policy.components?.map(part => <th key={part.name} className="p-2">{part.name} / {part.maxMarks}</th>)}<th className="p-2">Teacher remark</th></tr></thead>
      <tbody className="divide-y divide-border">{visible.map((student, index) => {
        const entry = student.results.find(item => item.subjectId === subject.id);
        if (!entry) return null;
        const value = draftFor(entry);
        return <tr key={student.id} className={drafts[entry.id] ? 'bg-amber-50/50' : ''}>
          <td className="p-2"><span className="mr-2 text-stone-500">{student.roll}</span>{student.name}</td>
          <td className="p-2"><select className={input} aria-label={`${student.name} result status`} disabled={readOnly || busy || !entry.id} value={value.status} onChange={event => change(entry, { status: event.target.value as Draft['status'] })}>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td>
          <td className="p-2"><input className={`${input} w-24`} inputMode="decimal" aria-label={`${student.name} marks`} data-row={index} data-col={0} value={value.marks} disabled={readOnly || busy || !entry.id} onChange={event => change(entry, { marks: event.target.value, status: event.target.value.trim() ? 'MARKED' : 'NOT_ENTERED' })} onPaste={event => paste(event, index)} onKeyDown={event => navigate(event, index, 0)} /></td>
          {subject.policy.components?.map((part, position) => <td key={part.name} className="p-2"><input className={`${input} w-24`} inputMode="decimal" aria-label={`${student.name} ${part.name}`} data-row={index} data-col={position + 1} disabled={readOnly || busy || value.status !== 'MARKED'} value={value.components[part.name] ?? ''} onKeyDown={event => navigate(event, index, position + 1)} onChange={event => {
            const components = { ...value.components, [part.name]: event.target.value };
            change(entry, { components, marks: String(Object.values(components).reduce((sum, item) => sum + Number(item), 0)) });
          }} /></td>)}
          <td className="p-2"><input className={`${input} min-w-40`} aria-label={`${student.name} remark`} maxLength={500} disabled={readOnly || busy} value={value.remark} onChange={event => change(entry, { remark: event.target.value })} />
            {entry.history?.length ? <details className="mt-1 text-xs text-stone-500"><summary>Correction history ({entry.history.length})</summary>{entry.history.map((item, position) => <p key={position} className="mt-2">v{item.reportVersion} / {new Date(item.at).toLocaleString()} ? Previously {item.before.status === 'MARKED' ? item.before.marks : item.before.status}: {item.reason}</p>)}</details> : null}
          </td>
        </tr>;
      })}</tbody>
    </table></div>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0 || busy} onClick={() => setPage(previous => previous - 1)}>Previous</Button><span className="text-xs">Page {page + 1} / {Math.max(1, Math.ceil(data.students.length / 50))}</span><Button variant="outline" size="sm" disabled={(page + 1) * 50 >= data.students.length || busy} onClick={() => setPage(previous => previous + 1)}>Next</Button></div>
      {!readOnly && <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await onSaved(); setDrafts({}); setReason(''); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not reload marks.'); }
        finally { setBusy(false); }
      }}>{dirty ? 'Discard and reload' : 'Reload sheet'}</Button><Button onClick={save} disabled={!dirty || busy || Object.keys(drafts).length > 500 || (published && reason.trim().length < 10)}>{busy ? 'Saving...' : `Save ${Object.keys(drafts).length || ''} changes`}</Button></div>}
    </div>
    {Object.keys(drafts).length > 500 && <p role="alert" className="text-sm text-red-700">Save at most 500 edited rows at once.</p>}
  </CardContent></Card>;
}
