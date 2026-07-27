export const pricingPlans = [
  {
    id: "BASIC",
    name: "Basic",
    audience: "Small schools",
    setup: "PKR 5,000",
    monthly: "PKR 3,000",
    monthlyDetail: "Flat monthly rate",
    scale: "Up to 200 students",
    tone: "basic",
    featured: false,
  },
  {
    id: "STANDARD",
    name: "Standard",
    audience: "Growing schools",
    setup: "PKR 8,000",
    monthly: "PKR 6 / student",
    monthlyDetail: "Minimum PKR 4,000 / month",
    scale: "Scales with enrollment",
    tone: "standard",
    featured: true,
  },
  {
    id: "PREMIUM",
    name: "Premium",
    audience: "Large institutions",
    setup: "PKR 12,000",
    monthly: "PKR 8 / student",
    monthlyDetail: "Based on active students",
    scale: "Built for larger rollouts",
    tone: "premium",
    featured: false,
  },
] as const;

export type PricingPlanId = (typeof pricingPlans)[number]["id"];

export function getPricingPlan(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return pricingPlans.find((plan) => plan.id === normalized);
}

export const pricingOffers = [
  {
    label: "12-month prepay",
    title: "Pay annually, save setup",
    detail: "Prepay 12 months and we will waive your setup fee.",
  },
  {
    label: "Each referral",
    title: "Refer a school",
    detail: "Get PKR 1,000 off your setup fee for every school you refer.",
  },
  {
    label: "First 10 schools",
    title: "Early Bird Q1 2026",
    detail: "Save 45% on the setup fee while the first 10 places remain.",
  },
] as const;
