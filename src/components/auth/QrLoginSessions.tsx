'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HistoryScope = { active: boolean; generation: number; revoking: boolean };
type Session = { id: string; deviceName: string; createdAt: string; expiresAt: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' };
const endpoint = '/api/auth/qr-login/sessions';
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function QrLoginSessions({ refreshKey }: { refreshKey: string }) {
  const [rows, setRows] = useState<Session[] | null>(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState('');
  const lifecycle = useRef<HistoryScope | null>(null);
  const load = useCallback(async () => {
    const current = lifecycle.current;
    if (!current || !current.active) return;
    const generation = ++current.generation;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load QR logins.');
      if (lifecycle.current === current && current.active && generation === current.generation) { setRows(data.sessions); setError(''); }
    } catch (failure) {
      if (lifecycle.current === current && current.active && generation === current.generation) setError(failure instanceof Error && failure.name === 'TimeoutError' ? 'Loading recent logins timed out. Please refresh.' : failure instanceof Error ? failure.message : 'Could not load QR logins.');
    }
  }, []);
  useEffect(() => {
    // Each mount owns an immutable request scope. Strict Mode cleanup must not
    // cancel a later mount or let an old request write into its state.
    const current: HistoryScope = { active: true, generation: 0, revoking: false };
    lifecycle.current = current;
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      if (lifecycle.current === current) lifecycle.current = null;
      current.active = false;
      current.generation++;
      // Ignore in-flight results instead of aborting fetch during React cleanup.
      // Each request still has its own eight-second network deadline.
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load]);
  useEffect(() => { void Promise.resolve().then(load); }, [load, refreshKey]);
  const revoke = async (id: string) => {
    const current = lifecycle.current;
    if (!current || !current.active || current.revoking) return;
    current.revoking = true;
    setRevoking(id);
    setError('');
    try {
      const response = await fetch(`${endpoint}/${id}`, { method: 'DELETE', headers: { 'X-QR-Login': '1' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Could not revoke this login.'); }
      if (lifecycle.current === current && current.active) await load();
    } catch (failure) {
      if (lifecycle.current === current && current.active) setError(failure instanceof Error ? failure.message : 'Could not revoke this login.');
    } finally {
      current.revoking = false;
      if (lifecycle.current === current && current.active) setRevoking('');
    }
  };
  const activeRows = rows?.filter(row => row.status === 'ACTIVE');
  return <section className="min-w-0" aria-label="Recent QR logins">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Recent QR logins</h3><Button variant="ghost" size="sm" onClick={() => { void load(); }}>Refresh</Button></div>
    <p className="mb-3 text-xs text-stone-500">Mobile sessions expire 30 days after login. Revoke a device to sign it out. Times are shown in your local timezone.</p>
    {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
    {rows === null ? <div role="status" className="flex items-center gap-2 py-4 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading recent logins...</div>
      : activeRows?.length === 0 ? <p className="py-3 text-sm text-stone-500">No active QR logins.</p>
      : <ul className="max-h-80 divide-y divide-border overflow-y-auto">{activeRows?.map(row => <li key={row.id} className="flex items-start gap-3 py-3">
        <span className="mt-0.5 flex shrink-0 items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /><Smartphone className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" /><span className="sr-only">Active device</span></span>
        <div className="min-w-0 flex-1"><p className="break-words text-[13px] font-medium leading-5">{row.deviceName}</p><p className="mt-1 text-[11px] leading-4 text-stone-500">Logged in {date(row.createdAt)}</p><p className="mt-0.5 text-[11px] leading-4 text-stone-500">Expires {date(row.expiresAt)}</p></div>
        {row.status === 'ACTIVE' && <Button variant="outline" size="sm" disabled={Boolean(revoking)} onClick={() => { void revoke(row.id); }}>{revoking === row.id ? 'Revoking...' : 'Revoke'}</Button>}
      </li>)}</ul>}
  </section>;
}
