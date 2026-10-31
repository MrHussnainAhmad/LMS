import { AppsManagement } from "@/components/AppsManagement";
import { getSession } from '@/lib/auth';
import { authorizeSecurityPermission } from '@/lib/security-permissions';
import { wipeDatabaseForTestingAction } from '@/app/actions/sa-actions';
import { ActionForm } from '@/components/ui/action-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { actionFeedback } from '@/lib/action-feedback';
import { redirect } from 'next/navigation';

export default async function SuperAdminAppsPage({ searchParams }: { searchParams: Promise<{ testing?: string }> }) {
  const params = await searchParams;
  if (params.testing === '1') {
    const session = await getSession();
    if (!session || !await authorizeSecurityPermission(session, 'platform.security')) redirect('/sa/apps');
    async function wipe(formData: FormData) {
      'use server';
      return actionFeedback(() => wipeDatabaseForTestingAction(formData));
    }
    return <section className="max-w-2xl space-y-5 rounded-lg border border-red-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Testing Time only</h1>
      <p>This permanently deletes every institution, campus, student, staff member, parent, employee, other admin, and all other application data. Only your current Super Admin account remains. You will need to sign in again.</p>
      <p className="font-medium text-red-700">This cannot be undone.</p>
      <ActionForm action={wipe} className="space-y-4">
        <label className="block text-sm font-medium">Type WIPE DATABASE to confirm
          <input name="confirmation" required pattern="WIPE DATABASE" autoComplete="off" className="mt-2 block w-full rounded-md border p-2" />
        </label>
        <SubmitButton variant="danger" loadingText="Wiping database...">Wipe database</SubmitButton>
      </ActionForm>
    </section>;
  }
  return <AppsManagement />;
}
