'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SERVICE_AGREEMENT_VERSION, SERVICE_AGREEMENT_INTRODUCTION, SERVICE_AGREEMENT_SECTIONS } from '@/lib/service-agreement';
import type { PricingPlan } from '@/lib/plan-types';

export function DealedAgreementPreview({ open, onOpenChange, plan, institutionName, address }: { open: boolean; onOpenChange: (open: boolean) => void; plan: PricingPlan; institutionName: string; address: string }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Nisaab360 Service Agreement</DialogTitle><DialogDescription>Version {SERVICE_AGREEMENT_VERSION} · {institutionName} · {address}</DialogDescription></DialogHeader><div className="space-y-5 text-sm leading-relaxed">
    <p>{SERVICE_AGREEMENT_INTRODUCTION}</p>
    <section className="rounded-md border p-4"><h2 className="font-bold">1. Selected Dealed plan</h2><p>{plan.name}</p><p>Monthly fee: <strong>{plan.monthly}</strong> — {plan.monthlyDetail}</p><p>One-time fee: {plan.setup}</p><p>{plan.scale} · {plan.campusDetail}</p><p>Devices allowed: {plan.deviceLimit}</p><p>Platform access: {plan.platforms.join(', ')}</p></section>
    {SERVICE_AGREEMENT_SECTIONS.map((section, index) => <section key={section.title}><h2 className="mb-2 font-bold">{index + 2}. {section.title}</h2><p>{section.content}</p></section>)}
  </div></DialogContent></Dialog>;
}
