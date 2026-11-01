import { AppsManagement } from "@/components/AppsManagement";
import { getSession } from '@/lib/auth';
import { authorizeSecurityPermission } from '@/lib/security-permissions';
import { wipeDatabaseForTestingAction } from '@/app/actions/sa-actions';
import { ActionForm } from '@/components/ui/action-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { actionFeedback } from '@/lib/action-feedback';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database, FlaskConical, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SuperAdminAppsPage({ searchParams }: { searchParams: Promise<{ testing?: string }> }) {
  const params = await searchParams;
  if (params.testing === '1') {
    const session = await getSession();
    if (!session || !await authorizeSecurityPermission(session, 'platform.security')) redirect('/sa/apps');
    async function wipe(formData: FormData) {
      'use server';
      return actionFeedback(() => wipeDatabaseForTestingAction(formData));
    }
    return <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand-950">Testing Time only</h1>
          <p className="text-sm text-stone-600">Reset application data when you have finished testing.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sa/apps"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Back to Apps</Link>
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="h-5 w-5 text-brand-600" aria-hidden="true" />Database reset</CardTitle>
            <CardDescription>Review what will be removed before confirming a reset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3 border-b border-border pb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600"><Database className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold text-brand-950">Application data will be removed</h2>
                <p className="text-sm leading-6 text-stone-600">All institutions, campuses, students, staff, parents, employees and other admins, together with academic records, payments, settings and other application data.</p>
              </div>
            </div>
            <div className="flex gap-3 border-b border-border pb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold text-brand-950">Your Super Admin account stays</h2>
                <p className="text-sm leading-6 text-stone-600">Only the Super Admin account you are currently using will remain, with the same login details.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600"><LogOut className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold text-brand-950">Sign in again after the reset</h2>
                <p className="text-sm leading-6 text-stone-600">The reset ends existing sessions. Use your current credentials to return to the admin portal.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="flex items-center gap-2 text-lg"><Trash2 className="h-5 w-5 text-danger" aria-hidden="true" />Confirm reset</CardTitle>
            <CardDescription>This permanently removes data and cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={wipe} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="database-reset-confirmation">Confirmation</Label>
                <p id="database-reset-help" className="text-sm leading-6 text-stone-600">Type <code className="rounded-sm bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-brand-950">WIPE DATABASE</code> to continue.</p>
                <Input id="database-reset-confirmation" name="confirmation" required pattern="WIPE DATABASE" autoComplete="off" spellCheck={false} aria-describedby="database-reset-help" placeholder="Enter confirmation phrase" />
              </div>
              <SubmitButton variant="danger" className="mt-5 w-full" loadingText="Wiping database..."><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />Wipe database</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>;
  }
  return <AppsManagement />;
}
