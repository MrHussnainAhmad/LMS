"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import { ArrowRight, Building2, GraduationCap, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/lib/api-client";

type LoginMode = "STUDENT_STAFF" | "INSTITUTION" | "EMPLOYEE";
type LoginIdentity = "STUDENT" | "STAFF";

type IdentityOption = {
  id: LoginIdentity;
  title: string;
  description: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  icon: ComponentType<{ className?: string }>;
};

type LoginFormProps = {
  mode?: LoginMode;
};

const identityOptions: IdentityOption[] = [
  {
    id: "STUDENT",
    title: "Student",
    description: "Use your roll number to view classes, attendance, marks, tests, and announcements.",
    identifierLabel: "Roll Number",
    identifierPlaceholder: "Enter your roll number",
    icon: GraduationCap,
  },
  {
    id: "STAFF",
    title: "Staff",
    description: "Use your staff email to manage attendance, tests, assignments, and classroom work.",
    identifierLabel: "Email",
    identifierPlaceholder: "Enter your staff email",
    icon: Users,
  },
];

const modeCopy = {
  STUDENT_STAFF: {
    eyebrow: "Student and Staff Login",
    title: "Access your learning workspace",
    description: "Students can sign in with roll number. Staff can sign in with their assigned email.",
    icon: Users,
    identifierLabel: "",
    identifierPlaceholder: "",
    footer: (
      <>
        <Link href="/institution-login" className="font-medium text-brand-900 hover:underline">
          Institution login
        </Link>
        <span className="text-stone-300">|</span>
        <Link href="/employee-login" className="font-medium text-brand-900 hover:underline">
          Employee login
        </Link>
      </>
    ),
  },
  INSTITUTION: {
    eyebrow: "Institution Login",
    title: "Manage your institution",
    description: "For institution owners and administrators managing campuses, staff, students, and academics.",
    icon: Building2,
    identifierLabel: "Contact Email",
    identifierPlaceholder: "Enter your institution contact email",
    footer: (
      <>
        <span className="text-stone-500">Need access? </span>
        <Link href="/register" className="font-medium text-brand-900 hover:underline">
          Request registration
        </Link>
      </>
    ),
  },
  EMPLOYEE: {
    eyebrow: "Employee Login",
    title: "Open your operations dashboard",
    description: "For Taleem360 employees handling platform operations and institution verification.",
    icon: UserCog,
    identifierLabel: "Email",
    identifierPlaceholder: "Enter your employee email",
    footer: (
      <Link href="/login" className="font-medium text-brand-900 hover:underline">
        Student or staff login
      </Link>
    ),
  },
};

export function LoginForm({ mode = "STUDENT_STAFF" }: LoginFormProps) {
  const [selectedIdentity, setSelectedIdentity] = useState<LoginIdentity>("STUDENT");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const copy = modeCopy[mode];
  const selectedOption =
    mode === "STUDENT_STAFF"
      ? identityOptions.find((option) => option.id === selectedIdentity) ?? identityOptions[0]
      : null;
  const PortalIcon = selectedOption?.icon ?? copy.icon;
  const identifierLabel = selectedOption?.identifierLabel ?? copy.identifierLabel;
  const identifierPlaceholder = selectedOption?.identifierPlaceholder ?? copy.identifierPlaceholder;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-border bg-stone-50 p-6 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-900 text-white">
                <PortalIcon className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {copy.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-display font-bold text-brand-950">
                {copy.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{copy.description}</p>
            </div>

            {mode === "STUDENT_STAFF" && (
              <div className="grid gap-3">
                {identityOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedIdentity === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedIdentity(option.id)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-brand-800 bg-white shadow-sm"
                          : "border-stone-200 bg-transparent hover:border-brand-300 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          isSelected ? "bg-brand-900 text-white" : "bg-white text-stone-500"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-brand-950">
                          {option.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-stone-500">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex h-full flex-col p-6">
          <div>
            <div className="mb-6">
              <p className="text-sm font-medium text-stone-500">Continue as</p>
              <h3 className="mt-1 text-2xl font-display font-semibold text-brand-950">
                {selectedOption?.title ?? (mode === "INSTITUTION" ? "Institution" : "Employee")}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-stone-700">{identifierLabel}</label>
                <Input
                  name="emailOrUsername"
                  placeholder={identifierPlaceholder}
                  autoComplete={selectedIdentity === "STUDENT" && mode === "STUDENT_STAFF" ? "username" : "email"}
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
              {isLoading ? "Logging in..." : "Login"}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-5 text-sm">
            {copy.footer}
          </div>
        </form>
      </div>
    </Card>
  );
}
