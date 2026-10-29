'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { planDifferences, type PricingPlan } from '@/lib/plan-types';
import { claimPortalNotice, releasePortalNotice } from '@/lib/portal-notice-lock';

type Change = { id: number; before: PricingPlan | null; after: PricingPlan | null; createdAt: string };
export function PricingPlanUpdateNotice() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, checking = false, lastCheck = 0;
    const controller = new AbortController();
    const check = async () => {
      if (!active || checking || !navigator.onLine || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"][data-state="open"]') || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now(); checking = true;
      try {
        const response = await fetch('/api/me/pricing-updates', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok || !active) return;
        const data = await response.json();
        if (active && Array.isArray(data.changes) && data.changes.length && !document.querySelector('[role="dialog"][data-state="open"]') && claimPortalNotice('pricing')) setChanges(data.changes);
      } catch { /* Notices must not interrupt work during network failures. */ }
      finally { checking = false; }
    };
    void check(); const timer = window.setInterval(() => void check(), 60_000);
    window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { active = false; releasePortalNotice('pricing'); controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, []);
  const dismiss = async () => {
    if (!changes.length || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/me/pricing-updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ through: changes[changes.length - 1].id }) });
      if (!response.ok) throw new Error();
      setChanges([]);
      releasePortalNotice('pricing');
    } catch { setError('Could not save your dismissal. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Dialog open={changes.length > 0} onOpenChange={open => { if (!open) void dismiss(); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Updates in Pricing Plans</DialogTitle><DialogDescription>Compare the previous public plans with the latest changes. Your recorded agreement pricing has not been replaced.</DialogDescription></DialogHeader>
    <div className="space-y-5">{changes.map(change => <section key={change.id} className="space-y-2"><h2 className="font-semibold">{change.after?.name ?? change.before?.name} — {!change.before ? 'New plan' : !change.after ? 'Removed' : 'Updated'}</h2><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-stone-50"><tr><th className="p-2">Detail</th><th className="p-2">Before</th><th className="p-2">Now</th></tr></thead><tbody>{planDifferences(change.before, change.after).map(row => <tr key={row.label} className="border-t"><th className="p-2 font-medium">{row.label}</th><td className="p-2 text-stone-500">{row.before}</td><td className="p-2">{row.after}</td></tr>)}</tbody></table></div></section>)}</div>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <DialogFooter className="gap-2"><Button asChild variant="outline"><a href="/pricing" target="_blank" rel="noopener noreferrer">View pricing plans</a></Button><Button disabled={busy} onClick={() => void dismiss()}>{busy ? 'Saving…' : 'Dismiss'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
