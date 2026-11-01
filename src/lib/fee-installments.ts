import type { FeeInvoicePlan } from '@/db/schema';
import { pakistanDateKey } from './parent-period';

/** Payments after plan creation settle installments in due-date order. */
export function invoiceInstallments(invoice: { paidAmount: number; plan?: FeeInvoicePlan }, today = pakistanDateKey()) {
  let available = Math.max(0, invoice.paidAmount - (invoice.plan?.paidAtSetup ?? 0));
  const installments = (invoice.plan?.installments ?? []).map(row => {
    const paid = Math.min(row.amount, available);
    available -= paid;
    return { ...row, paid, remaining: row.amount - paid };
  });
  return { installments, nextDueDate: installments.find(row => row.remaining > 0)?.dueDate ?? null,
    overdueAmount: installments.filter(row => row.dueDate < today).reduce((sum,row) => sum + row.remaining,0) };
}
