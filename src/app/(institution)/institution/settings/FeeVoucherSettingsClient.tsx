"use client";

import { useState, useTransition } from "react";
import { updateFeeVoucherSettingsAction } from "@/app/actions/institution-actions";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";

export function FeeVoucherSettingsClient({
  acceptFeeVouchers,
  openDay,
  lateDay,
  lateFee,
}: {
  acceptFeeVouchers: boolean;
  openDay: number | null;
  lateDay: number | null;
  lateFee: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(acceptFeeVouchers);
  const [openingDay, setOpeningDay] = useState(openDay?.toString() ?? "");
  const [lateVoucherDay, setLateVoucherDay] = useState(lateDay?.toString() ?? "");
  const [penalty, setPenalty] = useState(lateFee > 0 ? lateFee.toString() : "");
  const { toast } = useToast();

  const saveSettings = () => {
    startTransition(async () => {
      try {
        await updateFeeVoucherSettingsAction({
          acceptFeeVouchers: enabled,
          openDay: Number(openingDay),
          lateDay: Number(lateVoucherDay),
          lateFee: penalty.trim() ? Number(penalty) : 0,
        });
        toast({ title: "Settings Updated", description: "Fee voucher settings saved.", variant: "success" });
      } catch (err: unknown) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Could not save setting.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-stone-900">Accept Fee Vouchers</h4>
          <p className="text-sm text-stone-500">
            Open a monthly upload window and remind students automatically.
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            disabled={isPending}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
        </label>
      </div>

      {enabled && (
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-stone-800">Upload opens</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={28}
                required
                value={openingDay}
                onChange={(event) => setOpeningDay(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2"
                placeholder="2"
              />
              <span className="text-stone-500">day</span>
            </div>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-stone-800">Late from</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={28}
                required
                value={lateVoucherDay}
                onChange={(event) => setLateVoucherDay(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2"
                placeholder="5"
              />
              <span className="text-stone-500">day</span>
            </div>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-stone-800">Late fee (optional)</span>
            <div className="flex items-center gap-2">
              <span className="text-stone-500">PKR</span>
              <input
                type="number"
                min={0}
                max={1_000_000}
                step={1}
                value={penalty}
                onChange={(event) => setPenalty(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2"
                placeholder="0"
              />
            </div>
          </label>

          <p className="text-xs leading-5 text-stone-500 sm:col-span-3">
            Example: opening day 2 and late day 5 gives students the 2nd–4th to submit.
            Days are limited to 1–28 so the schedule works every month.
          </p>
        </div>
      )}

      <Button type="button" onClick={saveSettings} disabled={isPending}>
        {isPending ? "Saving..." : "Save fee voucher settings"}
      </Button>
    </div>
  );
}
