import { RegistrationForm } from "./RegistrationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen bg-stone-50 px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors hover:text-brand-900">
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
