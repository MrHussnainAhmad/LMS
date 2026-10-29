export type PlanDefinition = {
  id: string; kind: 'PUBLIC' | 'DEAL'; name: string;
  monthlyFeePaisa: number | null; setupFeePaisa: number | null; perStudentFeePaisa: number | null;
  studentLimit: number | null; studentCount: number | null; campusLimit: number | null;
  platforms: string[]; deviceLimit: number | null; platformManagedCampuses: boolean;
  audience: string; featured: boolean; revision: number;
};
export type PricingPlan = PlanDefinition & {
  monthly: string; setup: string; monthlyDetail: string; scale: string; campusDetail: string; tone: string;
};
export function formatRupees(paisa: number) {
  return `Rs. ${(paisa / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}
export function displayPlan(plan: PlanDefinition): PricingPlan {
  const perStudent = plan.monthlyFeePaisa === null && plan.perStudentFeePaisa !== null;
  return {
    id: plan.id, kind: plan.kind, name: plan.name, monthlyFeePaisa: plan.monthlyFeePaisa,
    setupFeePaisa: plan.setupFeePaisa, perStudentFeePaisa: plan.perStudentFeePaisa,
    studentLimit: plan.studentLimit, studentCount: plan.studentCount, campusLimit: plan.campusLimit,
    platforms: [...plan.platforms], deviceLimit: plan.deviceLimit, platformManagedCampuses: plan.platformManagedCampuses,
    audience: plan.audience, featured: plan.featured, revision: plan.revision,
    monthly: plan.monthlyFeePaisa !== null ? formatRupees(plan.monthlyFeePaisa) : plan.perStudentFeePaisa !== null ? `From ${formatRupees(plan.perStudentFeePaisa)}` : 'Custom',
    setup: plan.setupFeePaisa === null ? 'Custom' : formatRupees(plan.setupFeePaisa),
    monthlyDetail: perStudent ? 'per student/month (Negotiable depending on student count)' : plan.kind === 'DEAL' ? `${formatRupees(plan.perStudentFeePaisa ?? 0)} × ${plan.studentCount} students / month` : 'per month',
    scale: plan.studentLimit === null ? 'Custom student capacity' : `Up to ${plan.studentLimit.toLocaleString('en-PK')} students`,
    campusDetail: plan.campusLimit === null ? 'Unlimited campuses' : `${plan.campusLimit} campus${plan.campusLimit === 1 ? '' : 'es'} (including Main)`,
    tone: plan.featured ? 'standard' : 'basic',
  };
}
export const PLAN_DIFFERENCE_FIELDS = [
  ['name', 'Plan name'], ['monthly', 'Monthly fee'], ['setup', 'One-time fee'],
  ['monthlyDetail', 'Billing'], ['campusDetail', 'Campuses'], ['scale', 'Students'],
  ['platforms', 'Platform access'], ['deviceLimit', 'Devices allowed'],
  ['platformManagedCampuses', 'Campus management'], ['audience', 'Description'],
] as const;
export function planDifferences(before: PricingPlan | null, after: PricingPlan | null) {
  const text = (plan: PricingPlan | null, key: typeof PLAN_DIFFERENCE_FIELDS[number][0]) => {
    if (!plan) return 'Not available';
    const value = plan[key];
    if (key === 'platformManagedCampuses') return value ? 'Platform admins only' : 'Institution may manage campuses';
    return Array.isArray(value) ? value.join(', ') || 'None' : value === null ? 'Unlimited' : String(value);
  };
  return PLAN_DIFFERENCE_FIELDS.flatMap(([key, label]) => {
    const oldValue = text(before, key), newValue = text(after, key);
    return oldValue === newValue ? [] : [{ label, before: oldValue, after: newValue }];
  });
}
