import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, BarChart3, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, LayoutDashboard, Calendar, Bell, ChevronRight, PlayCircle, Star, MessageSquareQuote } from "lucide-react";
import { db } from "@/db";
import { institutions, platformReviews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Taleem360 | The Ultimate Platform for Modern Educational Institutions",
  description: "Taleem360 is the leading multi-tenant learning management system. Streamline administration, boost engagement, and leverage advanced analytics for your school, college, or university.",
  keywords: ["Learning Management System", "School ERP", "Student Information System", "EdTech", "Taleem360", "Multi-tenant LMS"],
  authors: [{ name: "Taleem360" }],
  openGraph: {
    title: "Taleem360 | Modern Educational Platform",
    description: "The next-generation platform for modern education. Simplify admin tasks and improve learning outcomes.",
    type: "website",
    url: "https://taleem360.com",
    siteName: "Taleem360"
  },
  twitter: {
    card: "summary_large_image",
    title: "Taleem360 | Modern Educational Platform",
    description: "Streamline administration and boost engagement.",
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Taleem360",
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

export default async function LandingPage() {
  const approvedInstitutions = await db.select({
    id: institutions.id,
    name: institutions.name,
    logoKey: institutions.logoKey
  }).from(institutions).where(eq(institutions.status, 'APPROVED'));

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

  const showMarquee = approvedInstitutions.length > 5;

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
          <div className="bg-brand-600 p-2 rounded-xl group-hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-extrabold text-2xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Taleem360</span>
        </div>
        
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="#testimonials" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Customers</Link>
          <Link href="#pricing" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Pricing</Link>
          <Link href="/login" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Login</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild className="rounded-full font-semibold shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all">
            <Link href="/register">Request as Institution</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center w-full">
        {/* Hero Section */}
        <section className="relative w-full max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-20 md:pt-32 md:pb-32 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 flex flex-col items-start text-left z-10">
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold text-stone-900 mb-6 leading-[1.05] tracking-tight">
              Manage your entire institution in <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">one place.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-stone-600 mb-10 leading-relaxed max-w-xl">
              From attendance tracking to advanced gradebooks and seamless parent communication. The modern OS for forward-thinking schools and universities.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button size="lg" className="rounded-full h-14 px-8 text-base font-semibold shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-1 transition-all group" asChild>
                <Link href="/register">
                  Request as Institution <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-base font-semibold bg-white border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition-all group" asChild>
                <Link href="/login">
                  Log in
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-100 to-indigo-50 rounded-[2.5rem] transform rotate-3 scale-105 -z-10"></div>
            <div className="relative bg-white rounded-[2rem] shadow-2xl shadow-stone-900/10 border border-stone-100 overflow-hidden">
               {/* Complex Mockup Right Side */}
               <div className="h-12 border-b border-stone-100 flex items-center px-6 gap-2 bg-stone-50/80">
                 <div className="w-3 h-3 rounded-full bg-stone-300"></div><div className="w-3 h-3 rounded-full bg-stone-300"></div><div className="w-3 h-3 rounded-full bg-stone-300"></div>
               </div>
               <div className="p-6">
                 <div className="flex items-center justify-between mb-8">
                   <div className="h-6 w-32 bg-stone-100 rounded"></div>
                   <div className="flex gap-2"><div className="h-8 w-8 bg-brand-50 rounded-full"></div><div className="h-8 w-8 bg-indigo-50 rounded-full"></div></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="h-24 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl p-4 flex flex-col justify-end shadow-inner shadow-white/20">
                     <div className="h-4 w-16 bg-white/30 rounded mb-2"></div>
                     <div className="h-6 w-24 bg-white/90 rounded"></div>
                   </div>
                   <div className="h-24 bg-white border border-stone-100 rounded-xl p-4 flex flex-col justify-end shadow-sm">
                     <div className="h-4 w-16 bg-stone-200 rounded mb-2"></div>
                     <div className="h-6 w-24 bg-stone-800 rounded"></div>
                   </div>
                 </div>
                 <div className="space-y-3">
                   {[1,2,3].map(i => (
                     <div key={i} className="h-16 w-full bg-stone-50 rounded-xl border border-stone-100 flex items-center px-4 gap-4">
                       <div className="w-10 h-10 rounded-full bg-stone-200"></div>
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
        {approvedInstitutions.length > 0 && (
          <section className="w-full border-y border-stone-200 bg-white py-10 overflow-hidden relative">
             <div className="max-w-7xl mx-auto px-6 md:px-12 text-center relative">
               <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10"></div>
               <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10"></div>
               
               <div className={showMarquee ? "flex whitespace-nowrap animate-marquee w-[200%]" : "flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-80 grayscale hover:grayscale-0 transition-all duration-500"}>
                 {/* Double the array for seamless infinite scroll if marquee is true */}
                 {(showMarquee ? [...approvedInstitutions, ...approvedInstitutions] : approvedInstitutions).map((inst, idx) => (
                   <div key={`${inst.id}-${idx}`} className="inline-flex items-center gap-3 px-8 opacity-80 grayscale hover:grayscale-0 transition-all duration-300 shrink-0">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     {inst.logoKey && <img src={inst.logoKey} alt={inst.name} className="h-8 w-auto object-contain max-w-[120px]" />}
                     {!inst.logoKey && <span className="text-xl font-display font-bold text-stone-800">{inst.name}</span>}
                   </div>
                 ))}
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
          <div className="max-w-5xl mx-auto bg-stone-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2"></div>
             
             <div className="relative z-10">
               <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">Ready to upgrade your institution?</h2>
               <p className="text-xl text-stone-300 mb-10 max-w-2xl mx-auto">Join hundreds of schools using Taleem360 to streamline operations and enhance learning.</p>
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
                <div className="bg-brand-600 p-1.5 rounded-lg">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="font-display font-bold text-2xl">Taleem360</span>
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
           <p className="text-stone-400 text-sm">&copy; {new Date().getFullYear()} Taleem360 Inc. All rights reserved.</p>
           <div className="text-stone-400 text-sm font-medium">Made with passion for educators.</div>
        </div>
      </footer>
    </div>
  );
}
