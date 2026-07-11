import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, LayoutDashboard, Calendar, Bell, ChevronRight, PlayCircle, Star, MessageSquareQuote } from "lucide-react";
import { db } from "@/db";
import { institutions, platformReviews, featuredInstitutions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

const pricingPlans = [
  {
    name: "Small School",
    students: "Up to 300 students",
    price: "PKR 7,000",
  },
  {
    name: "Medium School",
    students: "Up to 700 students",
    price: "PKR 12,000",
  },
  {
    name: "Large School",
    students: "Up to 1000 students",
    price: "PKR 20,000",
  },
];

export const metadata: Metadata = {
  title: "Nisaab360 | The Ultimate Platform for Modern Educational Institutions",
  description: "Nisaab360 is the leading multi-tenant learning management system. Streamline administration, boost engagement, and leverage advanced analytics for your school, college, or university.",
  keywords: ["Learning Management System", "School ERP", "Student Information System", "EdTech", "Nisaab360", "Multi-tenant LMS"],
  authors: [{ name: "Nisaab360" }],
  openGraph: {
    title: "Nisaab360 | Modern Educational Platform",
    description: "The next-generation platform for modern education. Simplify admin tasks and improve learning outcomes.",
    type: "website",
    url: "https://nisaab360.com",
    siteName: "Nisaab360"
  },
  twitter: {
    card: "summary_large_image",
    title: "Nisaab360 | Modern Educational Platform",
    description: "Streamline administration and boost engagement.",
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Nisaab360",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Any",
  "description": "A comprehensive, multi-tenant learning management system built for schools, colleges, and universities.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "1024"
  }
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const featuredLogos = await db
    .select()
    .from(featuredInstitutions)
    .orderBy(desc(featuredInstitutions.createdAt));

  const shouldMarqueeLogos = featuredLogos.length > 5;

  const latestReviews = await db.select({
    id: platformReviews.id,
    rating: platformReviews.rating,
    content: platformReviews.content,
    createdAt: platformReviews.createdAt,
    institutionName: institutions.name,
    logoKey: institutions.logoKey,
    city: institutions.city,
    country: institutions.country
  })
  .from(platformReviews)
  .innerJoin(institutions, eq(platformReviews.institutionId, institutions.id))
  .orderBy(desc(platformReviews.createdAt))
  .limit(3);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] selection:bg-brand-500 selection:text-white font-sans text-stone-900 scroll-smooth overflow-x-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="fixed inset-0 pointer-events-none -z-10 flex justify-center items-center overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand-300/10 blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-300/10 blur-[140px]"></div>
      </div>

      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 backdrop-blur-2xl bg-white/60 border-b border-stone-200/50 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-100 transition-transform group-hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo.png" alt="Nisaab360 logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-display font-extrabold text-2xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Nisaab360</span>
        </div>
        
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="#testimonials" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Customers</Link>
          <Link href="#pricing" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Pricing</Link>
          <Link href="/employee-login" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Employee Login</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild className="rounded-full font-semibold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all">
            <Link href="/register">Request as Institution</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center w-full">
        {/* Hero Section */}
        <section className="relative w-full max-w-7xl mx-auto px-6 md:px-12 pt-12 pb-12 md:pt-16 md:pb-16 flex flex-col lg:flex-row items-center gap-10 lg:min-h-[calc(100vh-73px)]">
          <div className="flex-1 flex flex-col items-start text-left z-10">
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-stone-900 mb-4 leading-[1.06] tracking-tight">
              Manage your entire institution in <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">one place.</span>
            </h1>
            
            <p className="text-base md:text-lg text-stone-600 mb-7 leading-relaxed max-w-xl">
              From attendance tracking to advanced gradebooks and seamless parent communication. The modern OS for forward-thinking schools and universities.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button size="lg" className="rounded-full h-12 px-7 text-base font-semibold shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-1 transition-all group" asChild>
                <Link href="/login">
                  Login <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full h-12 px-7 text-base font-semibold bg-white border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition-all group" asChild>
                <Link href="/institution-login">
                  Institution Login
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-100 to-indigo-50 rounded-[2.5rem] transform rotate-3 scale-105 -z-10"></div>
            <div className="relative bg-white rounded-[2rem] shadow-2xl shadow-stone-900/10 border border-stone-100 overflow-hidden">
               {/* Complex Mockup Right Side */}
               <div className="h-10 border-b border-stone-100 flex items-center px-5 gap-2 bg-stone-50/80">
                 <div className="w-3 h-3 rounded-full bg-stone-300"></div><div className="w-3 h-3 rounded-full bg-stone-300"></div><div className="w-3 h-3 rounded-full bg-stone-300"></div>
               </div>
               <div className="p-5">
                 <div className="flex items-center justify-between mb-5">
                   <div className="h-6 w-32 bg-stone-100 rounded"></div>
                   <div className="flex gap-2"><div className="h-8 w-8 bg-brand-50 rounded-full"></div><div className="h-8 w-8 bg-indigo-50 rounded-full"></div></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4 mb-5">
                   <div className="h-20 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl p-4 flex flex-col justify-end shadow-inner shadow-white/20">
                     <div className="h-4 w-16 bg-white/30 rounded mb-2"></div>
                     <div className="h-6 w-24 bg-white/90 rounded"></div>
                   </div>
                   <div className="h-20 bg-white border border-stone-100 rounded-xl p-4 flex flex-col justify-end shadow-sm">
                     <div className="h-4 w-16 bg-stone-200 rounded mb-2"></div>
                     <div className="h-6 w-24 bg-stone-800 rounded"></div>
                   </div>
                 </div>
                 <div className="space-y-2.5">
                   {[1,2,3].map(i => (
                     <div key={i} className="h-14 w-full bg-stone-50 rounded-xl border border-stone-100 flex items-center px-4 gap-4">
                       <div className="w-9 h-9 rounded-full bg-stone-200"></div>
                       <div className="flex-1 space-y-2"><div className="h-3 w-1/3 bg-stone-300 rounded"></div><div className="h-2 w-1/4 bg-stone-200 rounded"></div></div>
                       <div className="h-6 w-16 bg-green-100 rounded-full"></div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* --- Dynamic Social Proof Marquee --- */}
        {featuredLogos.length > 0 && (
           <section className="w-full border-y border-stone-200 bg-white py-10 overflow-hidden relative">
             <div className="max-w-7xl mx-auto px-6 md:px-12 text-center relative">
               <div className={shouldMarqueeLogos ? "flex w-max animate-marquee" : "flex flex-wrap justify-center"}>
                 <div className="flex items-center gap-16 py-4 px-8">
                  {featuredLogos.map((inst, i) => (
                    <div key={i} className="flex items-center gap-3 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300 shrink-0">
                      {inst.logoKey && (
                        <div className="h-10 w-10 bg-brand-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                          <img src={inst.logoKey} alt={inst.name} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <span className="font-display font-semibold text-stone-700 whitespace-nowrap">{inst.name}</span>
                    </div>
                  ))}
                 </div>

                {/* Duplicate for infinite marquee if needed */}
                {shouldMarqueeLogos && (
                  <div className="flex items-center gap-16 py-4 px-8" aria-hidden="true">
                    {featuredLogos.map((inst, i) => (
                      <div key={`dup-${i}`} className="flex items-center gap-3 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300 shrink-0">
                        {inst.logoKey && (
                          <div className="h-10 w-10 bg-brand-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                            <img src={inst.logoKey} alt={inst.name} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <span className="font-display font-semibold text-stone-700 whitespace-nowrap">{inst.name}</span>
                      </div>
                    ))}
                  </div>
                )}
               </div>
             </div>
          </section>
        )}

        {/* --- Bento Box Features --- */}
        <section id="features" className="w-full py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-stone-900 mb-6 tracking-tight">Everything you need, nothing you don't.</h2>
            <p className="text-lg text-stone-600">A meticulously crafted suite of tools designed to reduce administrative overhead and let educators focus on teaching.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
             <div className="md:col-span-2 md:row-span-2 relative p-8 rounded-3xl bg-stone-50 border border-stone-200 overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:border-brand-200 flex flex-col justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 max-w-md mb-8">
                  <div className="h-12 w-12 rounded-xl bg-brand-100 flex items-center justify-center mb-6 text-brand-700">
                     <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <h3 className="text-3xl font-display font-bold text-stone-900 mb-4">Unified Command Center</h3>
                  <p className="text-stone-600 text-lg">Manage multiple campuses, staff members, and thousands of students from a single, lightning-fast dashboard.</p>
                </div>
                <div className="relative z-10 bg-white rounded-t-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] border border-stone-200 border-b-0 h-48 w-full transform group-hover:-translate-y-2 transition-transform duration-500">
                   <div className="p-4 flex gap-4">
                     <div className="w-48 h-32 bg-stone-50 rounded-lg border border-stone-100"></div>
                     <div className="flex-1 space-y-4 pt-2">
                       <div className="h-4 w-3/4 bg-stone-200 rounded"></div>
                       <div className="h-4 w-1/2 bg-stone-100 rounded"></div>
                       <div className="h-4 w-2/3 bg-stone-100 rounded"></div>
                     </div>
                   </div>
                </div>
             </div>

             <div className="p-8 rounded-3xl bg-indigo-50 border border-indigo-100 overflow-hidden group hover:shadow-xl transition-all duration-500">
                <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-6 text-indigo-700">
                   <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-display font-bold text-stone-900 mb-3">Smart Timetables</h3>
                <p className="text-stone-700">Automate conflict resolution and generate optimal schedules instantly.</p>
             </div>

             <div className="p-8 rounded-3xl bg-stone-900 text-white border border-stone-800 overflow-hidden group hover:shadow-xl transition-all duration-500">
                <div className="h-12 w-12 rounded-xl bg-stone-800 flex items-center justify-center mb-6 text-stone-300">
                   <Bell className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-3">Instant Alerts</h3>
                <p className="text-stone-400">Push notifications for parents, students, and staff. Never miss an update.</p>
             </div>
          </div>
        </section>

        {/* --- Testimonials --- */}
        {latestReviews.length > 0 && (
          <section id="testimonials" className="w-full py-24 bg-stone-50 border-t border-stone-200">
             <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
               <h2 className="text-4xl font-display font-bold text-stone-900 mb-16 flex items-center justify-center gap-4">
                  <MessageSquareQuote className="h-10 w-10 text-brand-500" /> What institutions say
               </h2>
               <div className="grid md:grid-cols-3 gap-8 text-left">
                 {latestReviews.map((review) => (
                   <div key={review.id} className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 hover:shadow-xl transition-all duration-300 flex flex-col">
                     <div className="flex text-amber-400 mb-6">
                       {Array.from({length: 5}).map((_, i) => (
                          <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'fill-current' : 'text-stone-200'}`} />
                       ))}
                     </div>
                     <p className="text-lg text-stone-700 mb-8 italic flex-1">"{review.content}"</p>
                     <div className="flex items-center gap-4 mt-auto">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       {review.logoKey ? <img src={review.logoKey} alt={review.institutionName} className="w-12 h-12 rounded-full border border-stone-200 object-cover" /> : <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl">{review.institutionName.charAt(0)}</div>}
                       <div>
                         <div className="font-bold text-stone-900 line-clamp-1">{review.institutionName}</div>
                         <div className="text-sm text-stone-500">{review.city}, {review.country}</div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </section>
        )}

        {/* --- Final CTA --- */}
        <section id="pricing" className="w-full py-24 px-6 md:px-12">
          <div className="max-w-6xl mx-auto bg-stone-900 rounded-[3rem] p-8 md:p-14 lg:p-16 text-center relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
             
             <div className="relative z-10">
               <div className="mb-10">
                 <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-200 mb-4">Pricing</p>
                 <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">Simple plans for every institution.</h2>
                 <p className="text-lg md:text-xl text-stone-300 max-w-2xl mx-auto">Start with a one-time setup, then choose the monthly plan that matches your student strength.</p>
               </div>

               <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-white/10 bg-white/10 p-5 text-left backdrop-blur">
                 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                   <div>
                     <p className="text-sm font-semibold uppercase tracking-wider text-stone-300">One-time setup fee</p>
                     <p className="mt-1 text-sm text-stone-400">Institution setup, onboarding, and basic configuration.</p>
                   </div>
                   <p className="text-2xl font-display font-bold text-white">PKR 15,000</p>
                 </div>
               </div>

               <div className="grid gap-4 md:grid-cols-3 mb-10 text-left">
                 {pricingPlans.map((plan) => (
                   <div key={plan.name} className="rounded-2xl border border-white/10 bg-white p-6 shadow-xl shadow-black/10">
                     <p className="text-sm font-bold uppercase tracking-wider text-brand-700">{plan.name}</p>
                     <h3 className="mt-3 text-3xl font-display font-extrabold text-stone-950">{plan.price}</h3>
                     <p className="mt-1 text-sm font-semibold text-stone-500">per month</p>
                     <div className="mt-5 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                       <CheckCircle2 className="h-4 w-4 text-brand-600" />
                       {plan.students}
                     </div>
                   </div>
                 ))}
               </div>

               <div className="flex justify-center">
                 <Button size="lg" className="rounded-full h-14 px-10 text-base font-bold bg-white text-stone-900 hover:bg-stone-100 hover:scale-105 transition-all" asChild>
                   <a href="mailto:Workwithhussnainahmad@gmail.com">Contact Sales: Workwithhussnainahmad@gmail.com</a>
                 </Button>
               </div>
             </div>
          </div>
        </section>
      </main>

      {/* --- Professional Footer --- */}
      <footer className="w-full bg-stone-950 text-white border-t border-stone-800 pt-20 pb-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
           <div className="col-span-2">
             <div className="flex items-center gap-2 mb-6">
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-white ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Logo.png" alt="Nisaab360 logo" className="h-full w-full object-contain" />
                </div>
                <span className="font-display font-bold text-2xl">Nisaab360</span>
             </div>
             <p className="text-stone-400 text-sm max-w-xs mb-6">
               The next-generation platform for modern education. Simplify admin tasks, boost engagement, and leverage advanced analytics.
             </p>
           </div>
           
           <div>
             <h4 className="text-lg font-bold text-white mb-6">Company</h4>
             <ul className="space-y-4">
                <li><Link href="/about-us" className="text-stone-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/careers" className="text-stone-400 hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/blog" className="text-stone-400 hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/contact" className="text-stone-400 hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-6">Legal</h4>
              <ul className="space-y-4">
                <li><Link href="/privacy-policy" className="text-stone-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="text-stone-400 hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="text-stone-400 hover:text-white transition-colors">Security</Link></li>
                <li><Link href="/gdpr" className="text-stone-400 hover:text-white transition-colors">GDPR</Link></li>
              </ul>
            </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4">
           <p className="text-stone-400 text-sm">&copy; {new Date().getFullYear()} Nisaab360 Inc. All rights reserved.</p>
           <div className="text-stone-400 text-sm font-medium">Made with passion for educators.</div>
        </div>
      </footer>
    </div>
  );
}
