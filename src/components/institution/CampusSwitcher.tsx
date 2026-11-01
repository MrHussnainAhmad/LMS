'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toaster';

export function CampusSwitcher({ campuses, currentCampusId, homeCampusId }: {
  campuses: Array<{ id: number; name: string }>; currentCampusId: number; homeCampusId: number;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  async function switchCampus(campusId: number) {
    setBusy(true);
    try {
      await api.post('/api/institution/campus-view', { campusId });
      // Clear page, query and dialog state together when changing workspaces.
      window.location.assign(new URL('/institution/dashboard', window.location.origin).href);
    } catch (error) {
      toast({ title: 'Could not switch campus', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      setBusy(false);
    }
  }
  return <div className="min-w-0 space-y-1">
    <label htmlFor="campus-switcher" className="block text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-stone-500">View campus</label>
    <select id="campus-switcher" aria-describedby="campus-switcher-status" value={currentCampusId} disabled={busy}
      onChange={(event) => void switchCampus(Number(event.target.value))}
      className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-60">
      {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}{campus.id === homeCampusId ? ' (your campus)' : ' (read-only)'}</option>)}
    </select>
    <p id="campus-switcher-status" role="status" className="sr-only">{busy ? 'Switching campus…' : currentCampusId === homeCampusId ? 'Manage your campus.' : 'Viewing only. Changes are disabled.'}</p>
  </div>;
}
