"use client";

import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Subject = { id: number; name: string; code: string | null };
type Policy = { subjectId: number; maxMarks: number; policy: { passingPercentage?: number; components?: Array<{name: string; maxMarks: number}> } };
type Batch = { id: number; title: string; classId: number; officialPublishedAt: string | null };
const input = 'w-full rounded-md border border-border bg-white px-3 py-2 text-sm';

export function PublishResultsForm({ classes, sections, subjects, batches = [], onCreated }: {
  classes: Array<{id: number; name: string; level: number}>;
  sections: Array<{id: number; classId: number; name: string}>;
  subjects: Subject[]; batches?: Batch[]; onCreated?: (id: number) => void;
}) {
  const [title, setTitle] = useState(''), [type, setType] = useState('FINAL');
  const [classId, setClassId] = useState(''), [sectionId, setSectionId] = useState('');
  const [selected, setSelected] = useState<Policy[]>([]);
  const [reviewHours, setReviewHours] = useState(24), [requireSubjectPass, setRequireSubjectPass] = useState(true);
  const [periodStart, setPeriodStart] = useState(''), [periodEnd, setPeriodEnd] = useState('');
  const [supplementaryOf, setSupplementaryOf] = useState('');
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const earlier = batches.filter(batch => batch.classId === Number(classId) && batch.officialPublishedAt);
  const selectedSubjects = selected.map(policy => ({ ...subjects.find(subject => subject.id === policy.subjectId)!, ...policy }));

  const downloadTemplate = async () => {
    setError('');
    try {
      const response = await fetch(`/api/institution/batch-exams/template?classId=${classId}&sectionId=${sectionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const rows = data.students.map((student: {name: string; loginId: string}) => Object.fromEntries([
        ['Student ID', student.loginId], ['Student Name', student.name],
        ...selectedSubjects.flatMap(subject => [[subject.name, ''], ...(subject.policy.components ?? []).map(component => [`${subject.name}::${component.name}`, ''])]),
      ]));
      const url = URL.createObjectURL(new Blob([Papa.unparse(rows, { escapeFormulae: true })], { type: 'text/csv' }));
      const link = document.createElement('a'); link.href = url; link.download = 'exam-marks.csv'; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not download the template.'); }
  };

  const create = async () => {
    setBusy(true); setError('');
    try {
      let studentMarks: Array<{rollNumber: string; marks: Record<number, unknown>}> = [];
      if (file) {
        const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: 'greedy', transformHeader: header => header.trim() });
        if (parsed.errors.length) throw new Error('The CSV has invalid or duplicate columns. Download a fresh template.');
        const headers = parsed.meta.fields ?? [];
        const idColumn = headers.find(header => /^(student id|login id|roll number|rollnumber)$/i.test(header));
        if (!idColumn) throw new Error('CSV needs a Student ID or Roll Number column.');
        const matched = selectedSubjects.map(subject => ({ ...subject, column: headers.find(header => [subject.name.toLowerCase(), subject.code?.toLowerCase()].includes(header.toLowerCase())) }));
        if (matched.some(subject => !subject.column)) throw new Error('CSV must include every selected subject. Leave missing marks blank.');
        const recognized = new Set([idColumn, 'Student Name', ...matched.flatMap(subject => [subject.column!, ...(subject.policy.components ?? []).map(component => `${subject.column}::${component.name}`)])]);
        if (headers.some(header => !recognized.has(header))) throw new Error('CSV contains unknown columns. Use the downloaded template.');
        studentMarks = parsed.data.map((row, index) => {
          const identifier = row[idColumn]?.trim();
          if (!identifier) throw new Error(`Row ${index + 2}: student ID is missing.`);
          const marks: Record<number, unknown> = {};
          for (const subject of matched) {
            const raw = row[subject.column!]?.trim() ?? '';
            const aliases: Record<string, string> = { AB: 'ABSENT', EX: 'EXEMPT', WH: 'WITHHELD' };
            const status = aliases[raw.toUpperCase()] ?? raw.toUpperCase();
            if (!raw || ['ABSENT','EXEMPT','WITHHELD','NOT_ENTERED'].includes(status)) {
              marks[subject.id] = { status: status || 'NOT_ENTERED' }; continue;
            }
            if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > subject.maxMarks) throw new Error(`Row ${index + 2}: invalid ${subject.name} marks.`);
            const components = Object.fromEntries((subject.policy.components ?? []).map(component => [component.name, row[`${subject.column}::${component.name}`]]));
            marks[subject.id] = { status: 'MARKED', marks: raw, components };
          }
          return { rollNumber: identifier, marks };
        });
      }
      const termWeights = Object.entries(weights).filter(([,value]) => Number(value) > 0).map(([examId, weight]) => ({ examId: Number(examId), weight: Number(weight) }));
      const response = await fetch('/api/institution/batch-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, classId: Number(classId), sectionId: sectionId ? Number(sectionId) : undefined,
          subjects: selected, studentMarks, reviewHours, requireSubjectPass,
          periodStart: periodStart || undefined, periodEnd: periodEnd || undefined,
          supplementaryOf: supplementaryOf ? Number(supplementaryOf) : undefined,
          termWeights, ownWeight: 100 - termWeights.reduce((sum, source) => sum + source.weight, 0) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not create exam.');
      onCreated?.(body.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create exam.'); }
    finally { setBusy(false); }
  };

  return <Card>
    <CardHeader><CardTitle>Create exam draft</CardTitle><CardDescription>Start with an empty marks sheet or import a CSV. You approve publication after subject reviews.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Exam title<input className={input} maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label className="space-y-1 text-sm">Exam type<select className={input} value={type} onChange={event => setType(event.target.value)}>
          <option value="MONTHLY">Monthly</option><option value="MID">Mid term</option><option value="FINAL">Final term</option><option value="PROMOTION">Promotion</option>
        </select></label>
        <label className="space-y-1 text-sm">Class<select className={input} value={classId} onChange={event => { setClassId(event.target.value); setSectionId(''); setWeights({}); setSupplementaryOf(''); setFile(null); }}>
          <option value="">Select class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Section<select className={input} value={sectionId} onChange={event => { setSectionId(event.target.value); setFile(null); }}>
          <option value="">All sections (institution review)</option>{sections.filter(item => item.classId === Number(classId)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Teacher review hours<input type="number" min={1} max={168} className={input} value={reviewHours} onChange={event => setReviewHours(Number(event.target.value))} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireSubjectPass} onChange={event => setRequireSubjectPass(event.target.checked)} />Require a pass in each subject</label>
      </div>
      <fieldset className="space-y-3"><legend className="mb-2 font-medium">Subjects and passing rules</legend>
        {subjects.map(subject => {
          const value = selected.find(item => item.subjectId === subject.id);
          return <div key={subject.id} className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Boolean(value)} onChange={event => setSelected(previous => event.target.checked ? [...previous, { subjectId: subject.id, maxMarks: 100, policy: {} }] : previous.filter(item => item.subjectId !== subject.id))} />{subject.name}</label>
            {value && <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs">Maximum marks<input aria-label={`${subject.name} maximum marks`} type="number" min={1} className={input} value={value.maxMarks} onChange={event => setSelected(previous => previous.map(item => item.subjectId === subject.id ? { ...item, maxMarks: Number(event.target.value) } : item))} /></label>
              <label className="text-xs">Pass % (blank: school setting)<input aria-label={`${subject.name} pass percentage`} type="number" min={0} max={100} className={input} value={value.policy.passingPercentage ?? ''} onChange={event => setSelected(previous => previous.map(item => item.subjectId === subject.id ? { ...item, policy: { ...item.policy, passingPercentage: event.target.value === '' ? undefined : Number(event.target.value) } } : item))} /></label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(value.policy.components)} onChange={event => setSelected(previous => previous.map(item => item.subjectId === subject.id ? { ...item, policy: { ...item.policy, components: event.target.checked ? [{ name: 'Theory', maxMarks: Math.round(item.maxMarks * 0.8) }, { name: 'Practical', maxMarks: item.maxMarks - Math.round(item.maxMarks * 0.8) }] : undefined } } : item))} />Theory / practical</label>
              {value.policy.components?.map((component, index) => <label key={component.name} className="text-xs">{component.name} maximum<input type="number" min={1} className={input} value={component.maxMarks} onChange={event => setSelected(previous => previous.map(item => item.subjectId === subject.id ? { ...item, policy: { ...item.policy, components: item.policy.components?.map((part, position) => position === index ? { ...part, maxMarks: Number(event.target.value) } : part) } } : item))} /></label>)}
            </div>}
          </div>;
        })}
      </fieldset>
      <details className="rounded-md border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Attendance, earlier term weights and supplementary exam</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Attendance from<input type="date" className={input} value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></label>
          <label className="text-sm">Attendance through<input type="date" className={input} value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></label>
          <label className="text-sm">Supplementary for<select className={input} value={supplementaryOf} onChange={event => setSupplementaryOf(event.target.value)}><option value="">Regular exam</option>{earlier.map(batch => <option key={batch.id} value={batch.id}>{batch.title}</option>)}</select></label>
          <p className="self-center text-xs text-stone-500">Supplementary drafts include failed students who are still in this class. Promotion remains a separate reviewed action.</p>
          {earlier.map(batch => <label key={batch.id} className="text-sm">{batch.title} weight (%)<input type="number" min={0} max={100} className={input} value={weights[batch.id] ?? ''} onChange={event => setWeights(previous => ({ ...previous, [batch.id]: event.target.value }))} /></label>)}
          <p className="text-sm">This exam: {100 - Object.values(weights).reduce((sum, value) => sum + Number(value), 0)}%</p>
        </div>
      </details>
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm font-medium" htmlFor="exam-csv">Optional marks CSV</label><Button variant="outline" size="sm" disabled={!classId || !selected.length || busy} onClick={downloadTemplate}>Download template</Button></div>
        <input id="exam-csv" type="file" accept=".csv" onChange={event => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" />
        <p className="text-xs text-stone-500">Use Student ID to avoid duplicate class rolls. Blank = not entered; AB = absent; EX = exempt; WH = withheld. Zero is a valid mark. For components, complete the extra template columns.</p>
      </div>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Button onClick={create} disabled={busy || !title.trim() || !classId || !selected.length}>{busy ? 'Creating...' : 'Create draft'}</Button>
    </CardContent>
  </Card>;
}
