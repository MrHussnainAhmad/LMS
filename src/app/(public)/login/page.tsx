import { LoginForm } from "./LoginForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-brand-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-brand-950 mb-2">Welcome Back</h1>
          <p className="text-stone-500 text-sm">Select your role to login</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
