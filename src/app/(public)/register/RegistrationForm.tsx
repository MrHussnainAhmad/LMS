"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const STEPS = ["Details", "Location", "Documents & Setup"];

export function RegistrationForm() {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    username: "",
    country: "",
    city: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    registrationNumber: "",
    adminPassword: "",
    // Mocked for UI phase (R2 uploads can be implemented fully later)
    logoKey: "mock-logo-key",
    proofDocumentKey: "mock-doc-key",
  });

  const updateForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      nextStep();
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/api/institution/register", formData);
      setIsSuccess(true);
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "Please check your inputs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="p-8">
        <EmptyState 
          icon={CheckCircle2}
          title="Registration Submitted" 
          description="Your application is now pending verification. We will email you once it's approved."
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${idx <= step ? 'bg-brand-800 text-white' : 'bg-stone-100 text-stone-400'}`}>
              {idx + 1}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-12 sm:w-24 h-1 mx-2 rounded ${idx < step ? 'bg-brand-800' : 'bg-stone-100'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Institution Details</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Institution Name</label>
              <Input name="name" value={formData.name} onChange={updateForm} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select onValueChange={(val) => setFormData(p => ({ ...p, type: val }))} value={formData.type} required>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL">School</SelectItem>
                  <SelectItem value="COLLEGE">College</SelectItem>
                  <SelectItem value="UNIVERSITY">University</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Platform Username (Subdomain)</label>
              <Input name="username" value={formData.username} onChange={updateForm} placeholder="e.g. alliedschool" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Registration Number</label>
              <Input name="registrationNumber" value={formData.registrationNumber} onChange={updateForm} required />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Location & Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Country</label>
                <Input name="country" value={formData.country} onChange={updateForm} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">City</label>
                <Input name="city" value={formData.city} onChange={updateForm} required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Address</label>
              <Input name="address" value={formData.address} onChange={updateForm} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Contact Email</label>
                <Input type="email" name="contactEmail" value={formData.contactEmail} onChange={updateForm} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Contact Phone</label>
                <Input name="contactPhone" value={formData.contactPhone} onChange={updateForm} required />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-lg">Setup Admin Account</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Admin Password</label>
              <Input type="password" name="adminPassword" value={formData.adminPassword} onChange={updateForm} required minLength={8} />
              <p className="text-xs text-stone-500">This will be used along with your contact email to login.</p>
            </div>
            <div className="p-4 border border-dashed border-border rounded-md bg-stone-50 text-center">
              <p className="text-sm text-stone-600">Documents & Logo Upload simulated for UI phase.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 0}>
            Back
          </Button>
          <Button type="submit" disabled={isLoading}>
            {step === STEPS.length - 1 ? (isLoading ? "Submitting..." : "Submit Registration") : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
