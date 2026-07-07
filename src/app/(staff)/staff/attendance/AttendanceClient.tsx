"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Check, X, Clock, HelpCircle } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { submitAttendanceAction } from "@/app/actions/staff-actions";
import { useRouter } from "next/navigation";

const STATUS_STATES = [
  { value: "PRESENT", label: "P", color: "bg-success text-white border-success", icon: Check },
  { value: "ABSENT", label: "A", color: "bg-danger text-white border-danger", icon: X },
  { value: "LATE", label: "L", color: "bg-warning text-white border-warning", icon: Clock },
  { value: "LEAVE", label: "LV", color: "bg-stone-500 text-white border-stone-500", icon: HelpCircle },
];

export function AttendanceClient({ 
  assignedSections, 
  studentsBySection,
  todayAttendanceBySection = {}
}: { 
  assignedSections: any[], 
  studentsBySection: Record<number, any[]>,
  todayAttendanceBySection?: Record<number, boolean>
}) {
  const [selectedSectionId, setSelectedSectionId] = useState<number>(assignedSections[0]?.id || 0);
  
  const initialStudents = selectedSectionId ? studentsBySection[selectedSectionId]?.map(s => ({ ...s, status: "PRESENT" })) || [] : [];
  
  const [students, setStudents] = useState<any[]>(initialStudents);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSectionChange = (id: number) => {
    setSelectedSectionId(id);
    setStudents(studentsBySection[id]?.map(s => ({ ...s, status: "PRESENT" })) || []);
  };

  const toggleStatus = (id: number, newStatus?: string) => {
    setStudents(current => current.map(student => {
      if (student.id !== id) return student;
      if (newStatus) return { ...student, status: newStatus };
      const currentIndex = STATUS_STATES.findIndex(s => s.value === student.status);
      const nextIndex = (currentIndex + 1) % STATUS_STATES.length;
      return { ...student, status: STATUS_STATES[nextIndex].value };
    }));
  };

  const handleSubmit = async () => {
    if (!selectedSectionId) return;
    setIsSubmitting(true);
    try {
      const records = students.map(s => ({ studentId: s.id, status: s.status as any }));
      await submitAttendanceAction(selectedSectionId, new Date(), records);
      toast({ title: "Success", description: "Attendance submitted successfully", variant: "success" });
      router.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const presentCount = students.filter(s => s.status === "PRESENT").length;
  const isAlreadyMarked = Boolean(todayAttendanceBySection[selectedSectionId]);

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Mark Attendance</h1>
          <p className="text-stone-500 mt-1 text-sm lg:text-base">Select attendance status for each student</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={selectedSectionId}
            onChange={(e) => handleSectionChange(parseInt(e.target.value))}
            className="h-10 w-full sm:w-auto rounded-md border border-border bg-surface px-3 py-2 text-sm focus-ring min-w-[150px]"
          >
            {assignedSections.length === 0 && <option value={0}>No Assigned Classes</option>}
            {assignedSections.map(s => (
              <option key={s.id} value={s.id}>{s.className} - {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-2">
          {isAlreadyMarked && (
            <div className="p-4 mb-4 text-sm text-brand-900 bg-brand-50 border border-brand-200 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4" />
              Attendance has already been marked for this class today.
            </div>
          )}
          {students.length === 0 && (
            <div className="p-12 text-center text-stone-500 border border-border rounded-lg bg-surface">
              No students enrolled in this section.
            </div>
          )}
          {students.map((student) => {
            const statusConfig = STATUS_STATES.find(s => s.value === student.status)!;
            const Icon = statusConfig.icon;
            
            return (
              <div 
                key={student.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-surface shadow-sm gap-4"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-brand-900">{student.name}</span>
                  <span className="text-xs text-stone-500">{student.loginRollNumber}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUS_STATES.map((statusObj) => {
                    const isSelected = student.status === statusObj.value;
                    return (
                      <button
                        key={statusObj.value}
                        onClick={() => toggleStatus(student.id, statusObj.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border",
                          isSelected 
                            ? statusObj.color
                            : "bg-stone-50 text-stone-600 border-border hover:bg-stone-100"
                        )}
                      >
                        {statusObj.value.charAt(0) + statusObj.value.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden lg:block space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">Total Students</span>
                <span className="font-semibold">{students.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">Present</span>
                <span className="font-semibold text-success">{presentCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">Absent</span>
                <span className="font-semibold text-danger">{students.length - presentCount}</span>
              </div>
              
              <div className="pt-4 border-t border-border space-y-2">
                <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wider">Legend</p>
                {STATUS_STATES.map(s => (
                  <div key={s.value} className="flex items-center gap-2 text-sm">
                    <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold", s.color)}>
                      {s.label}
                    </div>
                    <span className="text-stone-600 capitalize">{s.value.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Action Bar for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-stone-500 block text-xs">Total</span>
              <span className="font-semibold">{students.length}</span>
            </div>
            <div>
              <span className="text-stone-500 block text-xs">Present</span>
              <span className="font-semibold text-success">{presentCount}</span>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting || isAlreadyMarked} className="bg-brand-800 hover:bg-brand-900 text-white min-w-[120px] disabled:opacity-50">
            {isAlreadyMarked ? "Marked" : isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>

      {/* Desktop Submit Button */}
      <div className="hidden lg:flex justify-end pt-6">
        <Button onClick={handleSubmit} disabled={isSubmitting || isAlreadyMarked} size="lg" className="bg-brand-800 hover:bg-brand-900 text-white min-w-[200px] disabled:opacity-50">
          {isAlreadyMarked ? "Attendance Already Marked" : isSubmitting ? "Submitting Attendance..." : "Submit Attendance"}
        </Button>
      </div>
    </div>
  );
}
