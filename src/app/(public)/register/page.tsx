import { RegistrationForm } from "./RegistrationForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6 lg:px-8">
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
