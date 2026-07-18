"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SaLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailOrUsername = formData.get("email");
    const password = formData.get("password");
    const securityAnswer = formData.get("securityAnswer");

    try {
      await api.post("/api/auth/login", {
        emailOrUsername,
        password,
        roleHint: "SUPER_ADMIN",
        securityAnswer,
      });

      toast({ title: "Authorized", description: "Welcome Super Admin", variant: "success" });
      
      const isLocal = window.location.hostname.includes("localhost");
      const protocol = isLocal ? "http://" : "https://";
      const baseHost = isLocal ? "localhost:3000" : "nisaab360.app";
      window.location.href = `${protocol}sa.${baseHost}/dashboard`;
    } catch (err: any) {
      toast({
        title: "Access Denied",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-950 p-4 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-brand-300 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8 flex flex-col items-center">
          <ShieldCheck className="h-12 w-12 text-brand-400 mb-4" />
          <h1 className="text-2xl font-display font-bold text-white mb-2">Restricted Area</h1>
          <p className="text-brand-300 text-sm">Super Admin Authentication</p>
        </div>

        <Card className="p-6 bg-surface border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Email</label>
              <Input name="email" type="email" placeholder="admin@domain.com" required />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Password</label>
              <Input name="password" type="password" placeholder="••••••••" required />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-700">Security Question Answer</label>
              <Input name="securityAnswer" type="password" placeholder="Answer your security question..." required />
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Login"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
