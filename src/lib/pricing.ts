export const pricingPlans = [
  {
    id: "BASIC",
    name: "Basic",
    audience: "Small schools",
    monthly: "Rs. 3,500",
    monthlyDetail: "per month",
    scale: "Up to 300 students",
    tone: "basic",
    featured: false,
  },
  {
    id: "STANDARD",
    name: "Standard",
    audience: "Growing schools",
    monthly: "Rs. 6,500",
    monthlyDetail: "per month",
    scale: "301–800 students",
    tone: "standard",
    featured: true,
  },
  {
    id: "PREMIUM",
    name: "Premium",
    audience: "Large institutions",
    monthly: "Rs. 11,000",
    monthlyDetail: "per month",
    scale: "801–1,500 students",
    tone: "premium",
    featured: false,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    audience: "Multi-campus institutions",
    monthly: "Custom",
    monthlyDetail: "Contact us for pricing",
    scale: "1,500+ students, multi-campus",
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
