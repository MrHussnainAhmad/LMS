'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { QrLoginSessions } from './QrLoginSessions';
import { CheckCircle2, Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Challenge = { challengeId: string; qrImageDataUrl: string; expiresAt: string; serverTime: string; status: string };
const endpoint = '/api/auth/qr-login';
const mutationHeaders = { 'X-QR-Login': '1' };

async function revoke(id: string) {
  // Keep a close/navigation cancellation alive while the page is going away.
  try { await fetch(`${endpoint}/${id}`, { method: 'DELETE', headers: mutationHeaders, cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(5000) }); }
  catch { /* A disconnected client cannot revoke; the server still enforces the short expiry. */ }
}

/** Both portal locations use the same account-bound flow; no identity props. */
export function QrLoginButton() {
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const lifecycle = useRef({ generation: 0, id: '', deadline: 0, generating: false });

  const generate = useCallback(async () => {
    if (lifecycle.current.generating) return;
    lifecycle.current.generating = true;
    const generation = ++lifecycle.current.generation;
    setBusy(true);
    setError('');
    setChallenge(null);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: mutationHeaders, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create a QR login code.');
      const next = data as Challenge;
      if (generation !== lifecycle.current.generation) { void revoke(next.challengeId); return; }
      lifecycle.current.id = next.challengeId;
      // Use server-relative lifetime, not the phone/browser wall clock.
      lifecycle.current.deadline = performance.now() + Math.max(0, Date.parse(next.expiresAt) - Date.parse(next.serverTime));
      setRemaining(Math.max(0, Math.ceil((lifecycle.current.deadline - performance.now()) / 1000)));
      setChallenge(next);
    } catch (failure) {
      if (generation === lifecycle.current.generation) setError(failure instanceof Error ? failure.message : 'QR login is unavailable.');
    } finally {
      if (generation === lifecycle.current.generation) { lifecycle.current.generating = false; setBusy(false); }
    }
  }, []);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) { void generate(); return; }
    lifecycle.current.generation++;
    const id = lifecycle.current.id;
    lifecycle.current.id = '';
    lifecycle.current.generating = false;
    setChallenge(null);
    setBusy(false);
    if (id) void revoke(id);
  };

  useEffect(() => () => {
    lifecycle.current.generation++;
    if (lifecycle.current.id) void revoke(lifecycle.current.id);
  }, []);

  useEffect(() => {
    if (!open || !challenge || challenge.status !== 'PENDING') return;
    let active = true;
    const generation = lifecycle.current.generation;
    let polling = false;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((lifecycle.current.deadline - performance.now()) / 1000));
      setRemaining(seconds);
      if (!seconds && !document.hidden) void poll(true);
    };
    const poll = async (atExpiry = false) => {
      if (!active || polling || document.hidden || generation !== lifecycle.current.generation ||
          (!atExpiry && performance.now() >= lifecycle.current.deadline)) return;
      polling = true;
      try {
        const response = await fetch(`${endpoint}/${challenge.challengeId}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        const data = await response.json();
        if (!active || generation !== lifecycle.current.generation) return;
        if (!response.ok) {
          setError(data.error || 'Could not check QR login. Generate a new code.');
          // Hide a code whose live session/eligibility could not be checked.
          setChallenge(current => current ? { ...current, status: 'UNAVAILABLE' } : null);
          return;
        }
        // Check the old challenge first: a last-second successful scan must stop renewal.
        if (data.status === 'EXPIRED' || (atExpiry && data.status === 'PENDING')) { await generate(); return; }
        if (data.status !== 'PENDING') setChallenge(current => current ? { ...current, status: data.status } : null);
      } catch {
        if (active && generation === lifecycle.current.generation) {
          setError('Connection lost. Generate a new code when you are back online.');
          setChallenge(current => current ? { ...current, status: 'UNAVAILABLE' } : null);
        }
      } finally { polling = false; }
    };
    const countdown = window.setInterval(tick, 500);
    const timer = window.setInterval(() => { void poll(); }, 3000);
    const visible = () => { tick(); void poll(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(countdown); document.removeEventListener('visibilitychange', visible); };
  }, [open, challenge, generate]);

  const pending = challenge?.status === 'PENDING' && remaining > 0 && !busy;
  const consumed = challenge?.status === 'CONSUMED';

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><QrCode className="h-4 w-4" aria-hidden="true" />QR Login</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800"><Smartphone className="h-4 w-4" aria-hidden="true" /></div>
            <DialogTitle>Sign in on your phone</DialogTitle>
          </div>
          <DialogDescription>Scan with QR Login in the Taleem360 mobile app to sign in to this account.</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-6 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-border bg-white p-3">
          {busy ? <div role="status" className="flex flex-col items-center gap-3 text-sm text-stone-500"><Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />Creating your secure code…</div>
            : pending ? <Image src={challenge.qrImageDataUrl} unoptimized width={232} height={232} alt="Temporary account login QR code. Do not share." className="h-auto w-full max-w-[232px]" />
            : <div className="px-4 text-center" role="status">{consumed ? <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" aria-hidden="true" /> : <QrCode className="mx-auto mb-3 h-10 w-10 text-stone-400" aria-hidden="true" />}<p className="font-semibold text-brand-950">{consumed ? 'You’re signed in on mobile' : error ? 'Code unavailable' : challenge?.status === 'REVOKED' ? 'Code cancelled' : 'This code has expired'}</p><p className="mt-2 text-sm text-stone-500">{consumed ? 'You can close this window.' : 'Generate a new code to continue.'}</p></div>}
        </div>
        {pending && <p className="text-center text-sm tabular-nums text-stone-600" role="timer" aria-label={`QR code expires in ${remaining} seconds`}>Expires in <span className="font-semibold text-brand-950">{remaining}s</span></p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => { void generate(); }} className="w-full gap-2"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />New QR</Button>
        </div>
        <div className="min-w-0 border-t border-border pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          {open && <QrLoginSessions refreshKey={challenge?.status === 'CONSUMED' ? challenge.challengeId : 'INITIAL'} />}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
