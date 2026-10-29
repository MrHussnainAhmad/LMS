'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { claimPortalNotice, releasePortalNotice } from '@/lib/portal-notice-lock';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type TermsNotice = { revision: string; account: string };
const storageKey = (account: string) => `nisaab360:terms-notice:v1:${account}`;
const CHECK_INTERVAL_MS = 60_000;

export default function TermsUpdateNotice() {
  const [notice, setNotice] = useState<TermsNotice | null>(null);
  const dismissed = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    let checking = false;
    let lastCheck = 0;
    const controller = new AbortController();

    const check = async () => {
      if (!active || checking || !navigator.onLine || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"][data-state="open"]') || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const response = await fetch('/api/me/terms', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!active) return;
        if (!response.ok) {
          if (response.status === 401) setNotice(null);
          return;
        }
        const data = await response.json();
        if (!active) return;
        if (!data.terms || typeof data.terms.revision !== 'string' || typeof data.account !== 'string') {
          setNotice(null);
          return;
        }
        let seen = dismissed.current.get(data.account);
        try { seen = localStorage.getItem(storageKey(data.account)) ?? seen; } catch { /* In-memory dismissal still works when storage is unavailable. */ }
        if (seen === data.terms.revision) { releasePortalNotice('terms'); setNotice(null); }
        else if (!document.querySelector('[role="dialog"][data-state="open"]') && claimPortalNotice('terms')) setNotice({ revision: data.terms.revision, account: data.account });
      } catch {
        // A failed notice check must not interrupt the user's work.
      } finally {
        checking = false;
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith('nisaab360:terms-notice:v1:')) return;
      setNotice(current => current && event.key === storageKey(current.account) && event.newValue === current.revision ? null : current);
    };
    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', check);
    return () => {
      active = false;
      releasePortalNotice('terms');
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const dismiss = () => {
    if (!notice) return;
    dismissed.current.set(notice.account, notice.revision);
    try { localStorage.setItem(storageKey(notice.account), notice.revision); } catch { /* Keep the popup dismissible in private/restricted browsers. */ }
    setNotice(null);
    releasePortalNotice('terms');
  };

  return (
    <Dialog open={notice !== null} onOpenChange={open => { if (!open) dismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <FileText className="mb-2 h-7 w-7 text-brand-600" aria-hidden="true" />
          <DialogTitle>Terms and conditions updated</DialogTitle>
          <DialogDescription>
            We have updated our terms and conditions. You can read the latest version now or ignore this notice and continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={dismiss}>Ignore</Button>
          <Button asChild>
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" onClick={dismiss}>Read<span className="sr-only"> terms and conditions (opens in a new tab)</span></a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
