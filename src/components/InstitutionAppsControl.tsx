'use client';

import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function InstitutionAppsControl({ institutionId, initialEnabled }: { institutionId: number; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/employee/institutions/${institutionId}/apps`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appsEnabled: enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save app access.');
      setEnabled(data.appsEnabled);
      setMessage({ error: false, text: data.appsEnabled ? 'App access enabled.' : 'App access disabled. Website access stays available.' });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Could not save app access.' });
    } finally { setSaving(false); }
  }
  return <Card>
    <CardHeader className="border-b border-border bg-stone-50/50">
      <CardTitle className="flex items-center gap-2 text-lg"><Smartphone className="h-5 w-5 text-brand-600" />Mobile apps</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 p-6">
      <label className="flex items-start gap-3 rounded-lg border border-border p-4">
        <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={saving} className="mt-1 h-4 w-4 accent-brand-700" />
        <span><span className="block text-sm font-semibold text-stone-900">Apps</span>
          <span className="mt-1 block text-xs leading-5 text-stone-500">Allow Students, Staff and Parents to use their mobile apps. Turning this off blocks app sign-ins and existing app access; web portals and the public website continue working. Disabling a main institution also blocks its campuses.</span>
        </span>
      </label>
      {message && <p role="status" className={`text-sm ${message.error ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>}
      <Button type="button" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save app access'}</Button>
    </CardContent>
  </Card>;
}
