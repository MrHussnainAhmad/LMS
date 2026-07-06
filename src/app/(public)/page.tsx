import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, BarChart3, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-brand-800" />
          <span className="font-display font-semibold text-xl text-brand-900">LMS Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-stone-600 hover:text-brand-900">
            Login
          </Link>
          <Button asChild>
            <Link href="/register">Register Institution</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-24 px-8 text-center bg-stone-50">
          <h1 className="text-5xl font-display font-bold text-brand-950 mb-6 max-w-3xl mx-auto leading-tight">
            The next-generation platform for modern education
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-10">
            A comprehensive, multi-tenant learning management system built for schools, colleges, and universities to manage everything from timetables to marks.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Student/Staff Login</Link>
            </Button>
          </div>
        </section>

        <section className="py-20 px-8 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-brand-800" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">Multi-Tenant Architecture</h3>
              <p className="text-stone-600 text-sm">Strict data isolation ensures your institution's data remains private and secure.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-brand-800" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">Advanced Analytics</h3>
              <p className="text-stone-600 text-sm">Visualize attendance trends and academic performance with real-time dashboards.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-brand-800" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">Enterprise Security</h3>
              <p className="text-stone-600 text-sm">RBAC, rate limiting, and modern encryption standards built-in by default.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-stone-500 text-sm border-t border-border bg-surface">
        &copy; {new Date().getFullYear()} LMS Platform. All rights reserved.
      </footer>
    </div>
  );
}
