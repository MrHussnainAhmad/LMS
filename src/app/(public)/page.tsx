import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, BarChart3, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Taleem360 | Modern Educational Platform",
  description: "A comprehensive, multi-tenant learning management system built for schools, colleges, and universities.",
  keywords: ["LMS", "Education", "School Management", "Taleem360", "Student Portal"],
  openGraph: {
    title: "Taleem360 | Modern Educational Platform",
    description: "The next-generation platform for modern education.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-stone-50 selection:bg-brand-500 selection:text-white relative overflow-hidden">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 flex justify-center items-center">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-300/20 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/20 blur-[120px]"></div>
      </div>

      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="bg-brand-600 p-2 rounded-xl group-hover:bg-brand-700 group-hover:scale-105 transition-all shadow-sm">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl bg-gradient-to-r from-brand-900 to-indigo-900 bg-clip-text text-transparent tracking-tight">Taleem360</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-stone-600 hover:text-brand-900 transition-colors">
            Login
          </Link>
          <Button asChild className="rounded-full shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all">
            <Link href="/register">Register Institution</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero Section */}
        <section className="relative w-full max-w-7xl mx-auto px-8 pt-32 pb-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100/80 text-brand-700 text-sm font-medium mb-8 border border-brand-200 backdrop-blur-sm hover:bg-brand-100 transition-colors shadow-sm cursor-pointer hover:scale-105">
            <Sparkles className="h-4 w-4" />
            <span>Discover the future of education</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-extrabold text-stone-900 mb-8 max-w-4xl mx-auto leading-[1.1] tracking-tight">
            The next-generation platform for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">modern education</span>
          </h1>
          
          <p className="text-xl text-stone-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            A comprehensive, multi-tenant learning management system built for schools, colleges, and universities to manage everything seamlessly.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 w-full sm:w-auto">
            <Button size="lg" className="rounded-full h-14 px-8 text-base shadow-xl shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-1 transition-all group" asChild>
              <Link href="/register">
                Get Started <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-base bg-white/50 backdrop-blur-sm border-stone-200 hover:bg-white hover:border-stone-300 hover:shadow-md transition-all" asChild>
              <Link href="/login">Student/Staff Login</Link>
            </Button>
          </div>
          
          {/* Dashboard Preview Mockup */}
          <div className="mt-24 relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl shadow-stone-900/10 border border-white/60 ring-1 ring-stone-900/5 group hover:shadow-brand-900/20 hover:-translate-y-2 transition-all duration-500">
             <div className="w-full aspect-[16/9] bg-[#faf9f8] flex flex-col">
               {/* Window Controls */}
               <div className="h-12 border-b border-stone-200 flex items-center px-6 gap-2 bg-white/80 backdrop-blur-md">
                 <div className="w-3.5 h-3.5 rounded-full bg-rose-400"></div>
                 <div className="w-3.5 h-3.5 rounded-full bg-amber-400"></div>
                 <div className="w-3.5 h-3.5 rounded-full bg-emerald-400"></div>
               </div>
               {/* Mock UI */}
               <div className="flex-1 flex p-6 gap-6">
                 {/* Sidebar */}
                 <div className="w-64 bg-white rounded-xl shadow-sm border border-stone-100 hidden md:flex flex-col gap-4 p-4">
                    <div className="h-8 w-2/3 bg-stone-100 rounded-md mb-4"></div>
                    <div className="h-10 w-full bg-brand-50 rounded-lg border border-brand-100"></div>
                    <div className="h-10 w-full bg-stone-50 rounded-lg"></div>
                    <div className="h-10 w-full bg-stone-50 rounded-lg"></div>
                    <div className="h-10 w-full bg-stone-50 rounded-lg mt-auto"></div>
                 </div>
                 {/* Main Content */}
                 <div className="flex-1 flex flex-col gap-6">
                   <div className="h-28 w-full bg-gradient-to-r from-brand-600 to-indigo-600 rounded-xl shadow-md p-6 flex flex-col justify-center">
                      <div className="h-6 w-1/3 bg-white/20 rounded-md mb-2"></div>
                      <div className="h-8 w-1/4 bg-white/40 rounded-md"></div>
                   </div>
                   <div className="flex-1 flex gap-6">
                     <div className="flex-[2] bg-white rounded-xl shadow-sm border border-stone-100 p-6 flex flex-col gap-4">
                        <div className="h-6 w-1/3 bg-stone-100 rounded-md mb-2"></div>
                        <div className="flex-1 bg-stone-50 rounded-lg flex items-end p-4 gap-2">
                           <div className="flex-1 bg-brand-200 rounded-t-md h-1/3"></div>
                           <div className="flex-1 bg-brand-300 rounded-t-md h-1/2"></div>
                           <div className="flex-1 bg-brand-400 rounded-t-md h-3/4"></div>
                           <div className="flex-1 bg-brand-500 rounded-t-md h-full"></div>
                        </div>
                     </div>
                     <div className="flex-1 bg-white rounded-xl shadow-sm border border-stone-100 p-6 flex flex-col gap-4">
                        <div className="h-6 w-1/2 bg-stone-100 rounded-md mb-2"></div>
                        <div className="flex-1 rounded-full border-8 border-brand-100 relative">
                           <div className="absolute inset-0 rounded-full border-8 border-brand-500 border-t-transparent border-r-transparent -rotate-45"></div>
                        </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-32 px-8 bg-white relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-display font-bold text-stone-900 mb-4">Enterprise-grade features</h2>
              <p className="text-lg text-stone-600 max-w-2xl mx-auto">Everything you need to run your educational institution efficiently and securely.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <article className="group relative p-8 rounded-3xl bg-stone-50 hover:bg-white border border-transparent hover:border-brand-100 hover:shadow-2xl hover:shadow-brand-900/5 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-brand-600 transition-all duration-300 shadow-sm">
                    <Users className="h-8 w-8 text-brand-700 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-2xl font-display font-semibold mb-3 text-stone-900">Multi-Tenant</h3>
                  <p className="text-stone-600 leading-relaxed">Strict data isolation ensures your institution's data remains private and secure at all times.</p>
                </div>
              </article>
              {/* Feature 2 */}
              <article className="group relative p-8 rounded-3xl bg-stone-50 hover:bg-white border border-transparent hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-900/5 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-indigo-600 transition-all duration-300 shadow-sm">
                    <BarChart3 className="h-8 w-8 text-indigo-700 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-2xl font-display font-semibold mb-3 text-stone-900">Advanced Analytics</h3>
                  <p className="text-stone-600 leading-relaxed">Visualize attendance trends and academic performance with real-time, interactive dashboards.</p>
                </div>
              </article>
              {/* Feature 3 */}
              <article className="group relative p-8 rounded-3xl bg-stone-50 hover:bg-white border border-transparent hover:border-purple-100 hover:shadow-2xl hover:shadow-purple-900/5 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                <div className="relative">
                  <div className="h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-purple-600 transition-all duration-300 shadow-sm">
                    <ShieldCheck className="h-8 w-8 text-purple-700 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-2xl font-display font-semibold mb-3 text-stone-900">Enterprise Security</h3>
                  <p className="text-stone-600 leading-relaxed">RBAC, rate limiting, and modern encryption standards built-in by default to protect your data.</p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer">
            <BookOpen className="h-5 w-5 text-brand-800 group-hover:text-brand-600 transition-colors" />
            <span className="font-display font-semibold text-xl text-stone-900 group-hover:text-brand-900 transition-colors">Taleem360</span>
          </div>
          <p className="text-stone-500 text-sm">
            &copy; {new Date().getFullYear()} Taleem360. All rights reserved.
          </p>
          <div className="flex gap-6">
             <Link href="#" className="text-sm font-medium text-stone-500 hover:text-brand-600 transition-colors">Privacy</Link>
             <Link href="#" className="text-sm font-medium text-stone-500 hover:text-brand-600 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
