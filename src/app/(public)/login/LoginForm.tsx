"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [activeTab, setActiveTab] = useState("STUDENT");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailOrUsername = formData.get("emailOrUsername");
    const password = formData.get("password");

    try {
      const res = await api.post<{ role: string, mustChangePassword: boolean }>("/api/auth/login", {
        emailOrUsername,
        password,
      });

      toast({ title: "Success", description: "Logged in successfully", variant: "success" });
      
      if (res.mustChangePassword) {
        router.push("/force-password-change");
      } else {
        router.push(`/${res.role.toLowerCase()}/dashboard`);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex w-full border-b border-border mb-6">
          {["STUDENT", "STAFF", "INSTITUTION", "EMPLOYEE"].map((role) => (
            <Tabs.Trigger
              key={role}
              value={role}
              className="flex-1 py-2 text-xs font-medium text-stone-500 data-[state=active]:text-brand-900 data-[state=active]:border-b-2 data-[state=active]:border-brand-900 transition-all hover:text-stone-700"
            >
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">
              {activeTab === "STUDENT" ? "Roll Number" : activeTab === "STAFF" ? "Email" : activeTab === "INSTITUTION" ? "Contact Email" : "Email"}
            </label>
            <Input name="emailOrUsername" placeholder={`Enter your ${activeTab === 'STUDENT' ? 'roll number' : 'email'}`} required />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-stone-700">Password</label>
            <Input name="password" type="password" placeholder="••••••••" required />
          </div>

          <Button type="submit" className="w-full mt-6" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Tabs.Root>
    </Card>
  );
}
