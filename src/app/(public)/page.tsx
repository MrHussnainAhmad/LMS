export const dynamic = "force-dynamic";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, LayoutDashboard, Calendar, Bell, Star, MessageSquareQuote } from "lucide-react";
import { FadeIn, HeroFadeIn, StaggerContainer, StaggerItem, ScaleIn } from "@/components/ui/scroll-animation";
import { AnimatedBackground, FloatingIcons } from "@/components/ui/animated-background";
import { db } from "@/db";
import { institutions, platformReviews, featuredInstitutions, students, tests } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { LiveStats } from "@/components/ui/live-stats";
import { InteractiveFeatures } from "@/components/ui/interactive-features";
import { unstable_cache } from "next/cache";

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
  title: "Nisaab360 | Best LMS Pakistan & School Management Software",
  description: "Nisaab360 is the leading Pakistani LMS and school management software. Streamline administration, boost engagement, and leverage advanced analytics for your school, college, or university.",
  keywords: ["Nisaab", "Nisaab360", "Pakistani LMS", "best LMS Pakistan", "LMS Pakistan", "school management software Pakistan", "School ERP", "EdTech"],
  authors: [{ name: "Nisaab360" }],
  openGraph: {
    title: "Nisaab360 | Best LMS Pakistan & School Management Software",
    description: "The next-generation Pakistani LMS. Simplify admin tasks and improve learning outcomes.",
    type: "website",
    url: "https://nisaab360.app",
    siteName: "Nisaab360"
  },
  twitter: {
    card: "summary_large_image",
    title: "Nisaab360 | Best LMS Pakistan",
    description: "Streamline administration and boost engagement with the best school management software in Pakistan.",
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Nisaab360",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Any",
  "description": "Nisaab360 is the best LMS Pakistan and comprehensive school management software.",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "PKR",
    "price": "7000"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "1024"
  }
};

export const revalidate = 300;

const getLandingData = unstable_cache(
  async () => {
    const [featuredLogos, latestReviews, instCount, studentsCount, testsCount] = await Promise.all([
      db
        .select()
        .from(featuredInstitutions)
        .orderBy(desc(featuredInstitutions.createdAt))
        .limit(20),
      db.select({
        id: platformReviews.id,
        rating: platformReviews.rating,
        content: platformReviews.content,
        createdAt: platformReviews.createdAt,
        institutionName: institutions.name,
        logoKey: institutions.logoKey,
        city: institutions.city,
        country: institutions.country,
      })
        .from(platformReviews)
        .innerJoin(institutions, eq(platformReviews.institutionId, institutions.id))
        .orderBy(desc(platformReviews.createdAt))
        .limit(3),
      db.select({ count: sql<number>`count(*)` }).from(institutions).where(eq(institutions.status, 'APPROVED')),
      db.select({ count: sql<number>`count(*)` }).from(students).where(sql`${students.deletedAt} IS NULL`),
      db.select({ count: sql<number>`count(*)` }).from(tests),
    ]);

    return { 
      featuredLogos, 
      latestReviews,
      stats: {
        institutions: Number(instCount[0]?.count || 0),
        students: Number(studentsCount[0]?.count || 0),
        tests: Number(testsCount[0]?.count || 0),
      }
    };
  },
  ["landing-page-data"],
  { revalidate: 300, tags: ["landing-page"] }
);

export default async function LandingPage() {
  const { featuredLogos, latestReviews, stats } = await getLandingData();

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFCFB] selection:bg-brand-500 selection:text-white font-sans text-stone-900 scroll-smooth overflow-x-hidden">
      <style>{`
        @keyframes landing-reveal {
          from { opacity: 0; transform: translate3d(0, 12px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .landing-reveal {
          animation: landing-reveal 420ms cubic-bezier(.2,.8,.2,1) both;
        }
        .landing-hover {
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .landing-hover:hover {
          transform: translate3d(0, -3px, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-reveal { animation: none; }
          .landing-hover { transition: none; }
          .landing-hover:hover { transform: none; }
        }
      `}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <AnimatedBackground />

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4 shadow-sm md:px-12">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image src="/Logo.png" alt="Nisaab360 logo" width={40} height={40} className="h-full w-full object-contain" />
          </div>
          <span className="font-display font-extrabold text-2xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Nisaab360</span>
        </div>
        
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="#testimonials" className="text-sm font-semibold text-stone-600 hover:text-stone-900">Customers</Link>
          <Link href="#pricing" className="text-sm font-semibold text-stone-600 hover:text-stone-900">Pricing</Link>
          <Link href="/download-app" className="text-sm font-semibold text-stone-600 hover:text-stone-900">Download</Link>
          <Link href="/employee-login" className="text-sm font-semibold text-stone-600 hover:text-stone-900">Employee Login</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild className="landing-hover rounded-full font-semibold shadow-lg shadow-brand-500/20 active:scale-100">
            <Link href="/register">Request as Institution</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center w-full">
        {/* Hero Section */}
        <section className="relative w-full max-w-7xl mx-auto px-6 md:px-12 pt-12 pb-12 md:pt-16 md:pb-16 flex flex-col lg:flex-row items-center gap-10 lg:min-h-[calc(100vh-73px)]">
          <FloatingIcons />
          <div className="flex-1 flex flex-col items-start text-left z-10">
            
            <HeroFadeIn direction="up" delay={0.1}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-stone-900 mb-4 leading-[1.06] tracking-tight">
                Manage your institution with the best <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">LMS in Pakistan.</span>
              </h1>
            </HeroFadeIn>
            
            <HeroFadeIn direction="up" delay={0.2}>
              <p className="text-base md:text-lg text-stone-600 mb-7 leading-relaxed max-w-xl">
                From attendance tracking to advanced gradebooks and seamless parent communication. The modern OS for forward-thinking schools and universities.
              </p>
            </HeroFadeIn>
            
            <HeroFadeIn direction="up" delay={0.3} className="w-full">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button size="lg" className="landing-hover h-12 rounded-full px-7 text-base font-semibold shadow-xl shadow-brand-500/25 active:scale-100" asChild>
                  <Link href="/login">
                    Login <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="landing-hover h-12 rounded-full border-stone-200 bg-white px-7 text-base font-semibold hover:bg-stone-50 active:scale-100" asChild>
                  <Link href="/institution-login">
                    Institution Login
                  </Link>
                </Button>
              </div>
            </HeroFadeIn>
          </div>
          
          <HeroFadeIn direction="left" delay={0.4} className="flex-1 w-full relative group">
            <div className="absolute inset-0 -z-10 scale-105 rotate-3 rounded-[2.5rem] bg-gradient-to-tr from-brand-100 to-indigo-50"></div>
            <div className="relative overflow-hidden rounded-[2rem] border border-stone-100 bg-white shadow-2xl shadow-stone-900/10">
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
          </HeroFadeIn>
        </section>

        {/* --- Dynamic Social Proof Marquee --- */}
        {featuredLogos.length > 0 && (
           <section className="w-full border-y border-stone-200 bg-white py-10 overflow-hidden relative">
             <div className="max-w-7xl mx-auto px-6 md:px-12 text-center relative">
               <div className="flex flex-wrap justify-center">
                 <div className="flex items-center gap-16 py-4 px-8">
                  {featuredLogos.map((inst, i) => (
                    <div key={i} className="flex shrink-0 items-center gap-3 grayscale opacity-60">
                      {inst.logoKey && (
                        <div className="h-10 w-10 bg-brand-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                          <img src={inst.logoKey} alt={inst.name} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <span className="font-display font-semibold text-stone-700 whitespace-nowrap">{inst.name}</span>
                    </div>
                  ))}
                 </div>
               </div>
             </div>
          </section>
        )}

        <LiveStats stats={stats} />
        
        <InteractiveFeatures />

        {/* --- Bento Box Features --- */}
        <section id="features" className="w-full py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
          <FadeIn direction="up" className="text-center mb-20 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-display font-bold text-stone-900 mb-6 tracking-tight">Everything you need, nothing you don&apos;t.</h2>
            <p className="text-lg text-stone-600">A meticulously crafted suite of tools designed to reduce administrative overhead and let educators focus on teaching.</p>
          </FadeIn>
          
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
             <StaggerItem className="landing-hover relative flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200 bg-stone-50 p-8 md:col-span-2 md:row-span-2">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 to-transparent" />
                <div className="relative z-10 max-w-md mb-8">
                  <div className="h-12 w-12 rounded-xl bg-brand-100 flex items-center justify-center mb-6 text-brand-700">
                     <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <h3 className="text-3xl font-display font-bold text-stone-900 mb-4">Unified Command Center</h3>
                  <p className="text-stone-600 text-lg">Manage multiple campuses, staff members, and thousands of students from a single, lightning-fast dashboard.</p>
                </div>
                <div className="relative z-10 h-48 w-full rounded-t-2xl border border-b-0 border-stone-200 bg-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)]">
                   <div className="p-4 flex gap-4">
                     <div className="w-48 h-32 bg-stone-50 rounded-lg border border-stone-100"></div>
                     <div className="flex-1 space-y-4 pt-2">
                       <div className="h-4 w-3/4 bg-stone-200 rounded"></div>
                       <div className="h-4 w-1/2 bg-stone-100 rounded"></div>
                       <div className="h-4 w-2/3 bg-stone-100 rounded"></div>
                     </div>
                   </div>
                </div>
             </StaggerItem>

             <StaggerItem className="landing-hover overflow-hidden rounded-3xl border border-indigo-100 bg-indigo-50 p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                   <Calendar className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-display text-2xl font-bold text-stone-900">Smart Timetables</h3>
                <p className="text-stone-700">Automate conflict resolution and generate optimal schedules instantly.</p>
             </StaggerItem>

             <StaggerItem className="landing-hover overflow-hidden rounded-3xl border border-stone-800 bg-stone-900 p-8 text-white">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-800 text-stone-300">
                   <Bell className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-display text-2xl font-bold">Instant Alerts</h3>
                <p className="text-stone-400">Push notifications for parents, students, and staff. Never miss an update.</p>
             </StaggerItem>
          </StaggerContainer>
        </section>

        {/* --- Testimonials --- */}
        {latestReviews.length > 0 && (
          <section id="testimonials" className="w-full py-24 bg-stone-50 border-t border-stone-200">
             <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
               <FadeIn direction="up">
                 <h2 className="text-4xl font-display font-bold text-stone-900 mb-16 flex items-center justify-center gap-4">
                    <MessageSquareQuote className="h-10 w-10 text-brand-500" /> What institutions say
                 </h2>
               </FadeIn>
               <StaggerContainer className="grid md:grid-cols-3 gap-8 text-left">
                 {latestReviews.map((review) => (
                   <StaggerItem key={review.id} className="landing-hover flex flex-col rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
                     <div className="flex text-amber-400 mb-6">
                       {Array.from({length: 5}).map((_, i) => (
                          <Star key={i} className={`w-5 h-5 ${i < review.rating ? 'fill-current' : 'text-stone-200'}`} />
                       ))}
                     </div>
                      <p className="text-lg text-stone-700 mb-8 italic flex-1">&ldquo;{review.content}&rdquo;</p>
                     <div className="flex items-center gap-4 mt-auto">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       {review.logoKey ? <img src={review.logoKey} alt={review.institutionName} className="h-12 w-12 rounded-full border border-stone-200 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">{review.institutionName.charAt(0)}</div>}
                       <div>
                         <div className="line-clamp-1 font-bold text-stone-900">{review.institutionName}</div>
                         <div className="text-sm text-stone-500">{review.city}, {review.country}</div>
                       </div>
                     </div>
                   </StaggerItem>
                 ))}
               </StaggerContainer>
             </div>
          </section>
        )}

        {/* --- Final CTA --- */}
        <section id="pricing" className="w-full py-24 px-6 md:px-12">
          <ScaleIn className="relative mx-auto max-w-6xl overflow-hidden rounded-[3rem] bg-stone-900 p-8 text-center shadow-2xl md:p-14 lg:p-16">
             <div className="absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-brand-500/20" />
             <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-y-1/2 -translate-x-1/2 rounded-full bg-indigo-500/20" />
             
             <div className="relative z-10">
               <FadeIn direction="up" delay={0.2} className="mb-10">
                 <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-200 mb-4">Pricing</p>
                 <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">Simple plans for every institution.</h2>
                 <p className="text-lg md:text-xl text-stone-300 max-w-2xl mx-auto">Start with a one-time setup, then choose the monthly plan that matches your student strength.</p>
               </FadeIn>

               <FadeIn direction="up" delay={0.3} className="mx-auto mb-6 max-w-xl rounded-2xl border border-white/10 bg-white/10 p-5 text-left">
                 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                   <div>
                     <p className="text-sm font-semibold uppercase tracking-wider text-stone-300">One-time setup fee</p>
                     <p className="mt-1 text-sm text-stone-400">Institution setup, onboarding, and basic configuration.</p>
                   </div>
                   <p className="text-2xl font-display font-bold text-white">PKR 15,000</p>
                 </div>
               </FadeIn>

               <StaggerContainer className="grid gap-4 md:grid-cols-3 mb-10 text-left">
                 {pricingPlans.map((plan) => (
                   <StaggerItem key={plan.name} className="landing-hover rounded-2xl border border-white/10 bg-white p-6 shadow-xl shadow-black/10">
                     <p className="text-sm font-bold uppercase tracking-wider text-brand-700">{plan.name}</p>
                     <h3 className="mt-3 text-3xl font-display font-extrabold text-stone-950">{plan.price}</h3>
                     <p className="mt-1 text-sm font-semibold text-stone-500">per month</p>
                     <div className="mt-5 flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                       <CheckCircle2 className="h-4 w-4 text-brand-600" />
                       {plan.students}
                     </div>
                   </StaggerItem>
                 ))}
               </StaggerContainer>

               <FadeIn direction="up" delay={0.4} className="flex justify-center">
                 <Button size="lg" className="landing-hover h-14 rounded-full bg-white px-10 text-base font-bold text-stone-900 hover:bg-stone-100 shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-100" asChild>
                   <a href="mailto:Workwithhussnainahmad@gmail.com">Contact Sales: Workwithhussnainahmad@gmail.com</a>
                 </Button>
               </FadeIn>
             </div>
          </ScaleIn>
        </section>
      </main>

      {/* --- Professional Footer --- */}
      <footer className="w-full bg-stone-950 text-white border-t border-stone-800 pt-20 pb-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
           <div className="col-span-2">
             <div className="flex items-center gap-2 mb-6">
                <div className="h-9 w-9 overflow-hidden rounded-lg bg-white ring-1 ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image src="/Logo.png" alt="Nisaab360 logo" width={40} height={40} className="h-full w-full object-contain" />
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
                <li><Link href="/about-us" className="text-stone-400 hover:text-white">About Us</Link></li>
                <li><Link href="/careers" className="text-stone-400 hover:text-white">Careers</Link></li>
                <li><Link href="/blog" className="text-stone-400 hover:text-white">Blog</Link></li>
                <li><Link href="/contact" className="text-stone-400 hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-6">Legal</h4>
              <ul className="space-y-4">
                <li><Link href="/privacy-policy" className="text-stone-400 hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="text-stone-400 hover:text-white">Terms of Service</Link></li>
                <li><Link href="/security" className="text-stone-400 hover:text-white">Security</Link></li>
                <li><Link href="/gdpr" className="text-stone-400 hover:text-white">GDPR</Link></li>
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
