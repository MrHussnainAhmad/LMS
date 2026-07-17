"use client";

import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/toaster";

export function StaffLeaveRequestButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [leaveType, setLeaveType] = useState<"single" | "multiple">("single");
  const [reason, setReason] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/staff/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          startDate: leaveType === "single" ? singleDate : startDate,
          endDate: leaveType === "single" ? singleDate : endDate,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit leave request");
      }

      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
      setOpen(false);
      // Reset form
      setReason("");
      setSingleDate("");
      setStartDate("");
      setEndDate("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex flex-col items-center justify-center p-4 rounded-lg bg-orange-50 hover:bg-orange-100 hover:text-orange-800 transition-colors text-orange-600 text-center gap-2 border border-transparent hover:border-orange-200 focus:outline-none">
        <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium">Request Leave</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-5 h-full">
            {/* Left Side: Creative Banner */}
            <div className="md:col-span-2 bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 sm:p-8 text-white flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mb-6">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-3xl font-display font-bold leading-tight mb-3">
                  Request<br/>a Leave
                </DialogTitle>
                <DialogDescription className="text-indigo-100 text-sm leading-relaxed">
                  Submit a leave application to the administration. We value your well-being.
                </DialogDescription>
              </div>
              <div className="mt-8 hidden md:block">
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                  <p className="text-sm italic text-indigo-50 font-medium leading-snug">"Unplugging is a critical part of sustained success."</p>
                </div>
              </div>
            </div>
            
            {/* Right Side: Form */}
            <div className="md:col-span-3 p-6 sm:p-8 bg-white">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-stone-700 font-semibold text-sm">How long do you need?</Label>
                  <RadioGroup
                    value={leaveType}
                    onValueChange={(v: string) => setLeaveType(v as "single" | "multiple")}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <div className="flex items-center space-x-3 bg-stone-50 border border-stone-200 px-4 py-3 rounded-lg flex-1 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all [&:has([data-state=active])]:bg-indigo-50 [&:has([data-state=active])]:border-indigo-500">
                      <RadioGroupItem value="single" id="single" className="text-indigo-600 border-indigo-200" />
                      <Label htmlFor="single" className="font-medium cursor-pointer w-full text-stone-700">One Day</Label>
                    </div>
                    <div className="flex items-center space-x-3 bg-stone-50 border border-stone-200 px-4 py-3 rounded-lg flex-1 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all [&:has([data-state=active])]:bg-indigo-50 [&:has([data-state=active])]:border-indigo-500">
                      <RadioGroupItem value="multiple" id="multiple" className="text-indigo-600 border-indigo-200" />
                      <Label htmlFor="multiple" className="font-medium cursor-pointer w-full text-stone-700">Multiple Days</Label>
                    </div>
                  </RadioGroup>
                </div>

                {leaveType === "single" ? (
                  <div className="space-y-2">
                    <Label htmlFor="singleDate" className="text-stone-600">Select Date</Label>
                    <Input
                      id="singleDate"
                      type="date"
                      required
                      className="bg-stone-50 border-stone-200 focus-visible:ring-indigo-500 h-11"
                      value={singleDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSingleDate(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-stone-600">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        required
                        className="bg-stone-50 border-stone-200 focus-visible:ring-indigo-500 h-11"
                        value={startDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate" className="text-stone-600">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        required
                        className="bg-stone-50 border-stone-200 focus-visible:ring-indigo-500 h-11"
                        value={endDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-stone-600">Reason for Leave</Label>
                  <Textarea
                    id="reason"
                    required
                    placeholder="E.g., Medical reasons, Family event..."
                    className="bg-stone-50 border-stone-200 focus-visible:ring-indigo-500 resize-none min-h-[80px]"
                    value={reason}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-stone-100 mt-6">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-700">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px] shadow-md shadow-indigo-500/20">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Request
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
