'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatRupees, type PricingPlan } from '@/lib/plan-types';
import { responseErrorMessage } from '@/lib/validation-errors';

type AdminPlan = PricingPlan & { redeemedAt: string | null; codeExpiresAt: string | null };
type Code = { code: string; expiresAt: string };

function PlanForm({ plan, kind, onSaved }: { plan?: AdminPlan; kind: 'PUBLIC' | 'DEAL'; onSaved: (created?: Code & { id: string }) => Promise<void> }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState(String((plan?.perStudentFeePaisa ?? 0) / 100));
  const [count, setCount] = useState(String(plan?.studentCount ?? ''));
  const [perStudent, setPerStudent] = useState(plan ? plan.monthlyFeePaisa === null && plan.perStudentFeePaisa !== null : false);
  const money = (value: FormDataEntryValue | null) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Fees must be positive rupee amounts with at most two decimal places.');
    return Math.round(Number(text) * 100);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSaving(true);
    const data = new FormData(event.currentTarget);
    const capacity = (name: string) => data.get(name) ? Number(data.get(name)) : null;
    try {
      const body = {
        kind, name: data.get('name'), monthlyFeePaisa: kind === 'DEAL' || perStudent ? null : money(data.get('monthly')),
        setupFeePaisa: kind === 'DEAL' ? 0 : money(data.get('setup')),
        perStudentFeePaisa: kind === 'DEAL' || perStudent ? money(data.get('rate')) : null,
        studentLimit: capacity('students'), studentCount: kind === 'DEAL' ? capacity('count') : null,
        campusLimit: capacity('campuses'), deviceLimit: kind === 'DEAL' ? capacity('devices') : null,
        platforms: String(data.get('platforms') ?? '').split(',').map(x => x.trim()).filter(Boolean),
        platformManagedCampuses: data.get('platformManaged') === 'on',
        audience: String(data.get('audience') ?? ''), featured: data.get('featured') === 'on',
        ...(plan ? { revision: plan.revision } : {}),
      };
      const response = await fetch(plan ? `/api/admin/plans/${plan.id}` : '/api/admin/plans', { method: plan ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const result = await response.json();
      await onSaved(result.code ? { ...result.code, id: result.plan.id } : undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this plan.'); }
    finally { setSaving(false); }
  };
  const field = 'flex flex-col gap-1.5 text-sm font-medium';
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={field}>Plan name<Input name="name" required minLength={2} maxLength={120} defaultValue={plan?.name ?? (kind === 'DEAL' ? 'Dealed' : '')} /></label>
      <label className={field}>Number of campuses allowed<Input name="campuses" type="number" min={1} max={1000000} defaultValue={plan?.campusLimit ?? (kind === 'DEAL' ? 1 : '')} placeholder="Blank = unlimited" /></label>
      <label className={field}>Up to students<Input name="students" type="number" min={1} max={1000000} required={kind === 'DEAL'} defaultValue={plan?.studentLimit ?? ''} placeholder="Blank = custom capacity" /></label>
      <label className={field}>Access to platforms<Input name="platforms" required maxLength={1600} defaultValue={plan?.platforms.join(', ') ?? 'Nisaab360'} placeholder="Platform names, separated by commas" /><span className="text-xs font-normal text-stone-500">Nisaab360 = full suite. Or choose Nisaab360 Web, Student App, Staff App, Parent App.</span></label>
      {kind === 'PUBLIC' ? <>
        <label className={field}>Monthly fee (Rs.)<Input name="monthly" type="number" min={0} step="0.01" required={!perStudent} disabled={perStudent} defaultValue={plan?.monthlyFeePaisa == null ? '' : plan.monthlyFeePaisa / 100} /></label>
        <label className={field}>One-time fee (Rs.)<Input name="setup" type="number" min={0} step="0.01" defaultValue={plan?.setupFeePaisa == null ? '' : plan.setupFeePaisa / 100} placeholder="Blank = custom" /></label>
        <label className={field}>Description<Input name="audience" maxLength={160} defaultValue={plan?.audience ?? ''} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perStudent} onChange={event => setPerStudent(event.target.checked)} />Advertise a starting per-student rate</label>
        {perStudent ? <label className={field}>Starting rate per student (Rs.)<Input name="rate" required type="number" min={0} step="0.01" value={rate} onChange={event => setRate(event.target.value)} /></label> : null}
        <label className="flex items-center gap-2 text-sm"><input name="featured" type="checkbox" defaultChecked={plan?.featured} />Feature this plan</label>
      </> : <>
        <label className={field}>Price per student (Rs.)<Input name="rate" required type="number" min={0} step="0.01" value={rate} onChange={event => setRate(event.target.value)} /></label>
        <label className={field}>Number of students billed<Input name="count" required type="number" min={1} max={1000000} value={count} onChange={event => setCount(event.target.value)} /></label>
        <label className={field}>Devices allowed<Input name="devices" required type="number" min={1} max={1000000} defaultValue={plan?.deviceLimit ?? ''} /><span className="text-xs font-normal text-stone-500">Each active sign-in uses one slot across the institution. Signing out releases it.</span></label>
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm">Monthly fee: <strong>{formatRupees(Math.round((Number(rate) || 0) * 100) * (Number(count) || 0))}</strong><p>Per-student price × billed students</p></div>
      </>}
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="platformManaged" type="checkbox" defaultChecked={plan?.platformManagedCampuses} />Only platform admins may create additional campuses</label>
    </div>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <Button disabled={saving} type="submit">{saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}</Button>
  </form>;
}

export function PlansManager({ initialPlans }: { initialPlans: AdminPlan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [editor, setEditor] = useState<{ kind: 'PUBLIC' | 'DEAL'; plan?: AdminPlan } | null>(null);
  const [codes, setCodes] = useState<Record<string, Code>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<AdminPlan | null>(null);
  const refresh = async () => {
    const response = await fetch('/api/admin/plans', { cache: 'no-store' });
    if (!response.ok) throw new Error(await responseErrorMessage(response));
    setPlans((await response.json()).plans);
  };
  const action = async (plan: AdminPlan, generate: boolean) => {
    setBusy(plan.id); setError('');
    try {
      const response = await fetch(`/api/admin/plans/${plan.id}${generate ? '/code' : ''}`, { method: generate ? 'POST' : 'DELETE' });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      const data = await response.json();
      if (generate) setCodes(previous => ({ ...previous, [plan.id]: data }));
      else setRemoving(null);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this action.'); }
    finally { setBusy(null); }
  };
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Pricing plans</h1><p className="mt-2 max-w-2xl text-sm text-stone-600">Public plans appear on the website and registration form. Institutions receive a comparison when public pricing changes. Accepted agreement pricing is preserved.</p></div><div className="flex gap-2"><Button onClick={() => setEditor({ kind: 'PUBLIC' })}><Plus size={16} className="mr-2" />Public plan</Button><Button variant="outline" onClick={() => setEditor({ kind: 'DEAL' })}>Dealed plan</Button></div></div>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {(['PUBLIC', 'DEAL'] as const).map(kind => <section key={kind} className="space-y-3"><h2 className="text-lg font-semibold">{kind === 'PUBLIC' ? 'Public plans' : 'Private Dealed offers'}</h2>{kind === 'DEAL' ? <p className="text-sm text-stone-600">Only the Dealed option is public during registration. Each offer is redeemable by one institution. Generate a fresh code whenever needed; it replaces the previous code and expires after seven days.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">{plans.filter(plan => plan.kind === kind).map(plan => <article key={plan.id} className="space-y-4 rounded-md border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{plan.name}</h3><p className="mt-1 font-bold">{plan.monthly} <span className="text-xs font-normal">{plan.monthlyDetail}</span></p></div><span className="text-xs text-stone-500">{plan.redeemedAt ? 'Redeemed' : kind === 'PUBLIC' ? 'Published' : 'Unused'}</span></div>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-stone-500">One-time fee</dt><dd>{plan.setup}</dd></div><div><dt className="text-stone-500">Campuses</dt><dd>{plan.campusDetail}</dd></div><div><dt className="text-stone-500">Students</dt><dd>{plan.scale}</dd></div><div><dt className="text-stone-500">Platforms</dt><dd>{plan.platforms.join(', ')}</dd></div>{kind === 'DEAL' ? <div><dt className="text-stone-500">Devices</dt><dd>{plan.deviceLimit}</dd></div> : null}</dl>
        {codes[plan.id] && !plan.redeemedAt ? <div className="rounded-md bg-brand-50 p-3"><strong className="font-mono text-2xl tracking-widest">{codes[plan.id].code}</strong><p className="text-xs">Expires {new Date(codes[plan.id].expiresAt).toLocaleString()}. All earlier codes for this offer are invalid.</p></div> : plan.codeExpiresAt ? <p className="text-xs text-stone-500">An unused code expires {new Date(plan.codeExpiresAt).toLocaleString()}. Generate a fresh code to show a new one.</p> : null}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={Boolean(plan.redeemedAt)} onClick={() => setEditor({ kind, plan })}><Pencil size={14} className="mr-2" />Edit</Button>{kind === 'DEAL' ? <Button size="sm" variant="outline" disabled={busy !== null || Boolean(plan.redeemedAt)} onClick={() => void action(plan, true)}><KeyRound size={14} className="mr-2" />Generate / show fresh code</Button> : null}<Button size="sm" variant="danger" disabled={busy !== null} onClick={() => setRemoving(plan)}><Trash2 size={14} className="mr-2" />Remove</Button></div>
      </article>)}</div>{plans.every(plan => plan.kind !== kind) ? <p className="text-sm text-stone-500">No plans yet.</p> : null}
    </section>)}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editor?.plan ? 'Edit' : 'Create'} {editor?.kind === 'DEAL' ? 'Dealed offer' : 'public plan'}</DialogTitle><DialogDescription>{editor?.kind === 'DEAL' ? 'Private pricing for one institution. Editing an unused offer invalidates its current code.' : 'Set the pricing and capacity shown to everyone.'}</DialogDescription></DialogHeader>{editor ? <PlanForm key={editor.plan?.id ?? editor.kind} {...editor} onSaved={async created => { await refresh(); setCodes(created ? { [created.id]: created } : {}); setEditor(null); }} /> : null}</DialogContent></Dialog>
    <Dialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null); }}><DialogContent><DialogHeader><DialogTitle>Remove {removing?.name}?</DialogTitle><DialogDescription>This stops new registrations using this plan and invalidates unused deal codes. Existing institutions keep their agreed plan.</DialogDescription></DialogHeader><Button variant="danger" disabled={busy !== null} onClick={() => { if (removing) void action(removing, false); }}>Remove plan</Button></DialogContent></Dialog>
  </div>;
}
