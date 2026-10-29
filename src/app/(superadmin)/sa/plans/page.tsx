import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listManagedPlans } from '@/lib/plan-management';
import { PlansManager } from '@/components/PlansManager';

export default async function PlansPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/login/super-admin');
  return <PlansManager initialPlans={await listManagedPlans()} />;
}
