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
    description: "For Nisaab360 employees handling platform operations and institution verification.",
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
  const roleHint = selectedOption?.id ?? (mode === "INSTITUTION" ? "INSTITUTION" : "EMPLOYEE");

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
        roleHint,
      });

      toast({ title: "Success", description: "Logged in successfully", variant: "success" });

      if (res.mustChangePassword) {
        router.push("/force-password-change");
      } else {
        let targetRole = res.role.toLowerCase();
        if (targetRole === "super_admin") targetRole = "sa";
        if (targetRole === "institution_admin") targetRole = "institution";
        
        const isLocal = window.location.hostname.includes("localhost");
        const protocol = isLocal ? "http://" : "https://";
        const baseHost = isLocal ? "localhost:3000" : "nisaab360.app";
        
        window.location.href = `${protocol}${targetRole}.${baseHost}/dashboard`;
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
        <div className="border-b border-border bg-stone-50 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-900 text-white">
                <PortalIcon className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {copy.eyebrow}
              </p>
              <h2 className="mt-3 text-xl sm:text-2xl font-display font-bold text-brand-950">
                {copy.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{copy.description}</p>
            </div>

            {mode === "STUDENT_STAFF" && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Select Role</p>
                  <span className="text-[11px] font-medium text-brand-700">Click to switch</span>
                </div>
                <div className="grid gap-2">
                {identityOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedIdentity === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedIdentity(option.id)}
                      aria-pressed={isSelected}
                      className={`group flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-brand-800 bg-white shadow-md ring-2 ring-brand-100"
                          : "border-stone-200 bg-white/60 hover:border-brand-400 hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          isSelected ? "bg-brand-900 text-white" : "bg-stone-100 text-stone-500 group-hover:bg-brand-50 group-hover:text-brand-800"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="block text-sm font-semibold text-brand-950">
                            {option.title}
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                              Active
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-stone-500">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex h-full flex-col p-4 sm:p-6">
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

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            {copy.footer}
          </div>

          {mode === "STUDENT_STAFF" && (
            <div className="mt-4 flex min-h-[78px] items-end justify-center overflow-hidden rounded-lg bg-stone-50 px-3 pt-3 sm:min-h-[95px]">
              <LoginPanelVector />
            </div>
          )}
        </form>
      </div>
    </Card>
  );
}

function LoginPanelVector() {
  return (
    <svg
      className="h-auto w-full max-w-[255px] text-brand-900"
      viewBox="0 0 360 160"
      fill="none"
      role="img"
      aria-label="Nisaab360 secure login illustration"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="28" y="28" width="224" height="116" rx="16" fill="white" stroke="#E7E5E4" />
      <rect x="48" y="50" width="94" height="10" rx="5" fill="#D6D3D1" />
      <rect x="48" y="76" width="160" height="12" rx="6" fill="#F5F5F4" />
      <rect x="48" y="100" width="128" height="12" rx="6" fill="#F5F5F4" />
      <rect x="48" y="124" width="72" height="12" rx="6" fill="#0F766E" />
      <circle cx="257" cy="48" r="38" fill="#ECFDF5" />
      <path
        d="M257 19L285 30V51C285 69.5 273.2 81.8 257 87C240.8 81.8 229 69.5 229 51V30L257 19Z"
        fill="#134E4A"
      />
      <path
        d="M247 52.5L254 59.5L269 43.5"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="290" cy="122" r="24" fill="#F0F9FF" />
      <circle cx="290" cy="113" r="8" fill="#0369A1" />
      <path d="M274 139C277.5 128.5 282.8 124 290 124C297.2 124 302.5 128.5 306 139" fill="#0369A1" />
      <path d="M24 154H336" stroke="#D6D3D1" strokeWidth="3" strokeLinecap="round" />
      <path d="M267 109C275 102.5 286 99.5 298 101" stroke="#A7F3D0" strokeWidth="4" strokeLinecap="round" />
      <path d="M282 92C292 88 304 89 315 95" stroke="#BFDBFE" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
