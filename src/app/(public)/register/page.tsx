import { RegistrationForm } from "./RegistrationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your Institution",
  description: "Join Nisaab360 and modernize your school management.",
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen bg-stone-50 px-4 py-6 sm:py-12 sm:px-6 lg:px-8">
      <Link href="/" className="relative sm:absolute sm:left-6 sm:top-6 mb-8 sm:mb-0 inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-brand-950 mb-2">Register Your Institution</h1>
          <p className="text-stone-500 text-sm">Join the platform and modernize your campus management.</p>
        </div>
        <RegistrationForm />
      </div>
    </div>
  );
}
