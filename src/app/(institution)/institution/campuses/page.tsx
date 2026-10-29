import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canManageCampuses, listInstitutionCampuses } from '@/lib/campus-workspaces';
import { CampusLoginForm } from '@/components/institution/CampusLoginForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstitutionPricingPlan } from '@/lib/pricing';

export default async function InstitutionCampusesPage() {
  const session = await getSession();
  if (!session || !['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role)) redirect('/institution-login');
  const [campuses, plan] = await Promise.all([
    listInstitutionCampuses(session),
    getInstitutionPricingPlan(session.institutionId!),
  ]);
  if (!plan) return <p>No plan is configured. Contact your platform administrator.</p>;
  const canManage = canManageCampuses(session) && !plan.platformManagedCampuses;
  const canSetUp = canManage && (plan.campusLimit === null || campuses.length <= plan.campusLimit);
  const canAdd = canManage && (plan.campusLimit === null || campuses.length < plan.campusLimit);
  return <div className="space-y-8">

    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Campus List</CardTitle></CardHeader><CardContent className="space-y-4">
        {campuses.map((campus) => {
          const hasLogin = campus.name === campus.workspaceName;
          const isMain = campus.workspaceId === session.rootInstitutionId && hasLogin;
          return <div key={campus.id} className="border border-stone-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{campus.name}</h2><p className="text-sm text-stone-500">{campus.address ?? 'Address not provided'}</p></div>
              <span className="text-xs font-medium text-brand-700">{isMain ? 'Main campus' : hasLogin ? 'Campus login enabled' : 'Login not set up'}</span>
            </div>
            {hasLogin ? <p className="mt-3 text-sm">Login email: <span className="font-medium">{campus.loginEmail}</span></p>
              : canSetUp ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-brand-700">Set up login</summary><div className="mt-4"><CampusLoginForm existingCampus={campus} /></div></details>
              : <p className="mt-3 text-sm text-stone-500">Contact the platform team to arrange this campus’s login.</p>}
          </div>;
        })}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{plan.name} campus access</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm">{plan.campusDetail}.</p>
        <p className="text-sm font-medium">{campuses.length} {plan.campusLimit === null ? 'campuses' : `of ${plan.campusLimit} campuses`} in use, including Main.</p>
        {plan.platformManagedCampuses ? <p className="text-sm text-stone-500">Contact a platform admin or employee to add a campus or set up its login.</p>
          : plan.campusLimit !== null && campuses.length >= plan.campusLimit ? <p className="text-sm text-stone-500">Your campus limit has been reached. Contact the platform team to change your plan.</p> : null}
        {canManage && <div>{canAdd && <h2 className="mb-4 font-semibold">Add New Campus</h2>}<CampusLoginForm allowCreate={canAdd} /></div>}
      </CardContent></Card>
    </div>
  </div>;
}
