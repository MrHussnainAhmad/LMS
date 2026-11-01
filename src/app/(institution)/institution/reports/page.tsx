import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { InstitutionReports } from '@/components/institution/InstitutionReports';

export default async function ReportsPage(){
  const session=await getSession();
  if(!session||!session.institutionId||!['INSTITUTION','INSTITUTION_ADMIN'].includes(session.role))redirect('/login');
  return <InstitutionReports actorKey={session.institutionId+':'+session.role+':'+session.userId} readOnly={session.campusReadOnly}/>;
}
