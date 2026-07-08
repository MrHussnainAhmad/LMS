import { LoginForm } from "../login/LoginForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function InstitutionLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-brand-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-brand-950 mb-2">Institution Login</h1>
          <p className="text-stone-500 text-sm">Manage your institution, campuses, staff, and students.</p>
        </div>
        <LoginForm mode="INSTITUTION" />
      </div>
    </div>
  );
}
