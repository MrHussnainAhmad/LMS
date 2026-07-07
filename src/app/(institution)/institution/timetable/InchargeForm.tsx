"use client";

import { updateClassInchargeAction } from "@/app/actions/institution-actions";
import { useToast } from "@/components/ui/toaster";
import { SubmitButton } from "@/components/ui/submit-button";

export function InchargeForm({
  sectionId,
  currentInchargeId,
  staff
}: {
  sectionId: number;
  currentInchargeId: number | null;
  staff: { id: number; name: string }[];
}) {
  const { toast } = useToast();

  return (
    <form action={async (formData) => {
      try {
        await updateClassInchargeAction(formData);
        toast({ title: "Success", description: "Class Incharge updated successfully.", variant: "success" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message || "Failed to update incharge", variant: "destructive" });
      }
    }} className="space-y-4">
      <input type="hidden" name="sectionId" value={sectionId} />

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Select Class Incharge</label>
        <select 
          key={currentInchargeId || "unassigned"}
          name="classTeacherId"
          defaultValue={currentInchargeId || ""}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">-- No Incharge Assigned --</option>
          {staff.map(st => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </select>
        <p className="text-xs text-stone-500 mt-2">The selected staff member will be the ONLY person authorized to mark attendance for this class.</p>
      </div>

      <SubmitButton className="w-full bg-brand-800 text-white rounded-md py-2 text-sm font-medium hover:bg-brand-900 transition-colors">
        Save Incharge
      </SubmitButton>
    </form>
  );
}
