"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function ForcePasswordChangePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");

    try {
      await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toast({ title: "Success", description: "Password updated. Please log in again.", variant: "success" });
      
      // Logout and redirect to login
      await api.post("/api/auth/logout", {});
      window.location.href = "/login";
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-danger" />
          </div>
          <h1 className="text-2xl font-display font-bold text-brand-950 mb-2">Update Password Required</h1>
          <p className="text-stone-500 text-sm">For security reasons, you must change your default password before accessing the platform.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Current Password</label>
              <Input name="currentPassword" type="password" required />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">New Password</label>
              <Input name="newPassword" type="password" required minLength={8} />
              <p className="text-xs text-stone-400">Must be at least 8 characters and not the default password.</p>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
