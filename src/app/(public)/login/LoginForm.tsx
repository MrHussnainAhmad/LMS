"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  GraduationCap,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/lib/api-client";

type LoginRole = "STUDENT" | "STAFF" | "INSTITUTION" | "EMPLOYEE";

type RoleOption = {
  role: LoginRole;
  title: string;
  description: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  icon: ComponentType<{ className?: string }>;
};

const roleOptions: RoleOption[] = [
  {
    role: "STUDENT",
    title: "Student",
    description: "Access classes, attendance, announcements, tests, and academic updates.",
    identifierLabel: "Roll Number",
    identifierPlaceholder: "Enter your roll number",
    icon: GraduationCap,
  },
  {
    role: "STAFF",
    title: "Staff",
    description: "Manage teaching work, attendance, announcements, and classroom activity.",
    identifierLabel: "Email",
    identifierPlaceholder: "Enter your email",
    icon: Users,
  },
  {
    role: "INSTITUTION",
    title: "Institution",
    description: "Open the institution dashboard for administration, setup, and oversight.",
    identifierLabel: "Contact Email",
    identifierPlaceholder: "Enter your contact email",
    icon: Building2,
  },
  {
    role: "EMPLOYEE",
    title: "Employee",
    description: "Sign in to your operational workspace for assigned responsibilities.",
    identifierLabel: "Email",
    identifierPlaceholder: "Enter your email",
    icon: UserCog,
  },
];

export function LoginForm() {
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>("STUDENT");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const selectedOption = roleOptions.find((option) => option.role === selectedRole) ?? null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedOption) {
      toast({
        title: "Select a portal",
        description: "Please choose how you want to sign in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailOrUsername = formData.get("emailOrUsername");
    const password = formData.get("password");

    try {
      const res = await api.post<{ role: string; mustChangePassword: boolean }>("/api/auth/login", {
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
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-5">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Select Portal
          </p>
          <h2 className="mt-2 text-xl font-display font-semibold text-brand-950">
            Sign in with the right workspace
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Taleem360 keeps each role focused on the tools and information meant for them.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.role;

            return (
              <button
                key={option.role}
                type="button"
                onClick={() => setSelectedRole(option.role)}
                className={`group flex min-h-[136px] flex-col rounded-lg border p-4 text-left transition-all ${
                  isSelected
                    ? "border-brand-800 bg-brand-50 shadow-sm"
                    : "border-border bg-white hover:border-brand-300 hover:bg-stone-50"
                }`}
              >
                <span
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-md ${
                    isSelected ? "bg-brand-900 text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-brand-950">{option.title}</span>
                <span className="mt-1 text-sm leading-5 text-stone-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        {selectedOption ? (
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-500">Signing in as</p>
                <h3 className="mt-1 text-2xl font-display font-semibold text-brand-950">
                  {selectedOption.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-stone-500 transition-colors hover:border-brand-300 hover:text-brand-900 lg:hidden"
                aria-label="Choose another portal"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">
                  {selectedOption.identifierLabel}
                </label>
                <Input
                  name="emailOrUsername"
                  placeholder={selectedOption.identifierPlaceholder}
                  autoComplete={selectedOption.role === "STUDENT" ? "username" : "email"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">Password</label>
                <Input
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Continue"}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>

            {selectedOption.role === "INSTITUTION" && (
              <div className="mt-4 text-center text-sm">
                <span className="text-stone-500">Need institution access? </span>
                <Link href="/register" className="font-medium text-brand-900 hover:underline">
                  Request registration
                </Link>
              </div>
            )}
          </form>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-stone-100 text-stone-500">
              <ArrowLeft className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-display font-semibold text-brand-950">
              Choose a portal to continue
            </h3>
            <p className="mt-2 max-w-xs text-sm text-stone-500">
              Select student, staff, institution, or employee access from the left side.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
