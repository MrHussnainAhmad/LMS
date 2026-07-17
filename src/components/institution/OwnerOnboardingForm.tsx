"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { createInstitutionOwnerAction } from "@/app/actions/institution-actions";
import { Building2, UserCircle, Phone, Mail, User } from "lucide-react";

export function OwnerOnboardingForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      await createInstitutionOwnerAction(formData);
      toast({
        title: "Welcome aboard!",
        description: "Your details have been saved successfully.",
      });
      // Force hard refresh to clear the onboarding view
      window.location.reload();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-surface p-8 rounded-2xl shadow-xl border border-brand-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-500 to-accent-500" />
        
        <div className="text-center mb-8 mt-2">
          <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-display font-bold text-brand-950">Welcome to LMS</h1>
          <p className="text-stone-500 mt-2 text-sm">
            Please provide your details as the owner to set up your institution dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-2.5 h-5 w-5 text-stone-400" />
                <Input id="name" name="name" className="pl-10" placeholder="John Doe" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select name="gender" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-stone-400" />
                <Input id="email" name="email" type="email" className="pl-10" placeholder="john@example.com" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-stone-400" />
                <Input id="contactNumber" name="contactNumber" className="pl-10" placeholder="+1234567890" required />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "Saving..." : "Continue to Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
