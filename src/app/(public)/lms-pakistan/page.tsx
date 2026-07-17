import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Best LMS Pakistan & School Management Software | Nisaab360",
  description: "Nisaab360 is Pakistan's leading school management software and Learning Management System (LMS). Built specifically for the educational ecosystem in Pakistan.",
  alternates: {
    canonical: "/lms-pakistan",
  },
};

export default function LmsPakistanLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCFB] selection:bg-brand-500 selection:text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 backdrop-blur-2xl bg-white/60 border-b border-stone-200/50">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-display font-extrabold text-2xl tracking-tight text-brand-900">Nisaab360</span>
        </Link>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Register Institution</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-stone-900 mb-6">
            The Best <span className="text-brand-600">LMS in Pakistan</span> & Complete School Management Software
          </h1>
          <p className="text-lg text-stone-600 mb-8 leading-relaxed">
            Tailored specifically for Pakistani schools, colleges, and academies. Automate attendance, fee collection, result generation, and online learning with Nisaab360.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="rounded-full" asChild>
              <Link href="/register">
                Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
            <h2 className="text-2xl font-bold mb-4">Why choose Nisaab360?</h2>
            <ul className="space-y-4">
              {["Built for local fee structures & challans", "WhatsApp & SMS notifications integration", "Urdu/English bilingual support architecture", "Customizable report cards & grading rules"].map((feat, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-brand-500 shrink-0" />
                  <span className="text-stone-700">{feat}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-brand-50 p-8 rounded-2xl shadow-sm border border-brand-100">
            <h2 className="text-2xl font-bold mb-4 text-brand-900">Modernize Your Campus</h2>
            <p className="text-brand-800 mb-6">
              Replace outdated desktop software and messy spreadsheets with a cloud-native, real-time dashboard accessible from anywhere in Pakistan.
            </p>
            <Button variant="outline" className="w-full bg-white" asChild>
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
