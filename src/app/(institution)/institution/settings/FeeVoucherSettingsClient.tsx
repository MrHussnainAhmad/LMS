"use client";

import { useTransition } from "react";
import { updateFeeVoucherSettingsAction } from "@/app/actions/institution-actions";
import { useToast } from "@/components/ui/toaster";


export function FeeVoucherSettingsClient({ acceptFeeVouchers }: { acceptFeeVouchers: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleToggle = (checked: boolean) => {
    startTransition(async () => {
      try {
        await updateFeeVoucherSettingsAction(checked);
        toast({ title: "Settings Updated", description: "Fee voucher settings saved.", variant: "success" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-medium text-stone-900">Accept Fee Vouchers</h4>
        <p className="text-sm text-stone-500">Allow students to upload fee vouchers from their dashboard.</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          defaultChecked={acceptFeeVouchers} 
          disabled={isPending}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
      </label>
    </div>
  );
}
