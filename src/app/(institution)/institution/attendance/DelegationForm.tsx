'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toaster';
import { responseErrorMessage } from '@/lib/validation-errors';

export function DelegationForm({ sectionId, date, today, currentStaffId, staff }: {
  sectionId: number; date: string; today: string; currentStaffId: number | null;
  staff: { id: number; name: string }[];
}) {
  const [staffId, setStaffId] = useState(currentStaffId?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/institution/attendance/delegation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, date, staffId: staffId ? Number(staffId) : null }),
      });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      toast({ title: 'Saved', description: staffId ? `Substitute access assigned for ${date}.` : 'Substitute access removed.', variant: 'success' });
      router.refresh();
    } catch (error) {
      toast({ title: 'Could not save', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  }}>
    <label htmlFor="attendance-substitute" className="block text-sm font-medium">Substitute for {date}</label>
    <select id="attendance-substitute" value={staffId} onChange={event => setStaffId(event.target.value)}
      disabled={saving || date < today} className="w-full rounded-md border border-border bg-surface p-2">
      <option value="">No substitute / remove access</option>
      {staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select>
    <p className="text-sm text-stone-600">Access applies only on this date, using Pakistan time. The regular Class Incharge keeps their assignment and access.</p>
    <Button type="submit" disabled={saving || date < today}>{saving ? 'Saving…' : 'Save substitute access'}</Button>
  </form>;
}
