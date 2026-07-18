import { LoginForm } from "./LoginForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student & Staff Login",
  description: "Login to your Nisaab360 student or staff account.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 relative">
      <Link href="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-brand-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to Home</span>
      </Link>
      <div className="w-full max-w-4xl mt-8 sm:mt-0">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-brand-950 mb-2">Student & Staff Login</h1>
          <p className="text-stone-500 text-sm">Access your Nisaab360 classroom workspace.</p>
        </div>
        <LoginForm mode="STUDENT_STAFF" />
      </div>
    </div>
  );
}
