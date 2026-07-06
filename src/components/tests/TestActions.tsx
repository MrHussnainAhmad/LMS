"use client";

import { useState } from "react";
import { deleteOnlineTestAction, updateOnlineTestAction } from "@/app/actions/online-test-actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Trash2, Edit2, X } from "lucide-react";

export function TestActions({ testId, currentTitle, currentDurationMinutes }: { testId: number, currentTitle: string, currentDurationMinutes: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this test? All student submissions and marks will be permanently lost.")) return;
    setIsDeleting(true);
    try {
      await deleteOnlineTestAction(testId);
    } catch (e: any) {
      alert(e.message || "Failed to delete test");
      setIsDeleting(false);
    }
  };

  const handleUpdate = async (formData: FormData) => {
    try {
      await updateOnlineTestAction(formData);
      setIsEditing(false);
    } catch (e: any) {
      alert(e.message || "Failed to update test");
    }
  };

  if (isEditing) {
    return (
      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
        <form action={handleUpdate} className="space-y-4 rounded-md border border-border bg-stone-50 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-brand-950">Edit Test Details</h4>
          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <input type="hidden" name="testId" value={testId} />
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Test Title</label>
            <input 
              name="title" 
              required 
              defaultValue={currentTitle} 
              className="w-full rounded-md border border-border px-3 py-2 text-sm" 
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Duration (Minutes)</label>
            <input 
              name="durationMinutes" 
              type="number" 
              min="1" 
              required 
              defaultValue={currentDurationMinutes} 
              className="w-full rounded-md border border-border px-3 py-2 text-sm" 
            />
          </div>
        </div>
        
        <SubmitButton>Save Changes</SubmitButton>
      </form>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}
      >
        <Edit2 className="mr-2 h-4 w-4" />
        Edit Title/Timer
      </Button>
      <Button 
        type="button" 
        variant="outline" 
        size="sm" 
        className="text-danger hover:bg-danger/10 hover:text-danger"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {isDeleting ? "Deleting..." : "Delete Test"}
      </Button>
    </div>
  );
}
