import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Download Nisaab360 for Android | School Management App",
  description: "Download the official Nisaab360 Android app for secure access to attendance, marks, timetables, announcements, and school management tools.",
  keywords: ["Nisaab360 Android app", "school management app Pakistan", "LMS Android app", "student attendance app", "download Nisaab360"],
  alternates: { canonical: "/download-app" },
  openGraph: {
    title: "Download Nisaab360 for Android",
    description: "The official school management app for Nisaab360 institutions, staff, students, and families.",
    url: "/download-app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Download Nisaab360 for Android",
    description: "Access attendance, marks, timetables, and school updates on the go.",
  },
  robots: { index: true, follow: true },
};

export default function DownloadAppPage() {
  return (
    <main className="flex-1 overflow-hidden bg-stone-50">
      <section className="relative border-b border-stone-200 bg-gradient-to-br from-brand-950 via-brand-900 to-indigo-950 px-6 py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur">
            <Smartphone className="h-8 w-8" />
          </div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[0.2em] text-brand-100">Official Nisaab360 Android app</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Your school, connected wherever you are.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-brand-50 sm:text-lg">
            Stay connected to attendance, marks, timetables, announcements, and the important updates that keep your institution moving.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[1.35fr_0.65fr] lg:py-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-7 shadow-xl shadow-stone-900/5 sm:p-10">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <h2 className="font-bold">Google Play release in progress</h2>
                <p className="mt-1 text-sm leading-6 text-emerald-900">
                  The Nisaab360 Mobile App is currently completing its Google Play testing phase. The Play Store release will be available shortly. You may wait for the official listing or install the current verified Android package now.
                </p>
              </div>
            </div>
          </div>

          <h2 className="mt-8 text-2xl font-bold tracking-tight text-stone-950">Download the official Android app</h2>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">
            Use the button below to download the latest Nisaab360 APK directly from our official website. This package is intended for Android devices.
          </p>
          <Button asChild size="lg" className="mt-7 rounded-full">
            <Link href="/api/download-app" prefetch={false}>
              <Download className="mr-2 h-5 w-5" />
              Download Nisaab360 APK
            </Link>
          </Button>
          <p className="mt-4 flex items-center gap-2 text-sm text-stone-500"><ShieldCheck className="h-4 w-4 text-success" /> Download only from this official Nisaab360 page.</p>
        </div>

        <aside className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
          <h2 className="text-lg font-bold text-stone-950">What you can do</h2>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-stone-600">
            {[
              "View timetable and school announcements.",
              "Keep track of attendance, marks, and results.",
              "Access essential academic updates on the go.",
            ].map((item) => (
              <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />{item}</li>
            ))}
          </ul>
          <div className="mt-7 border-t border-stone-100 pt-6 text-sm text-stone-500">
            Already use Nisaab360? Sign in with the credentials provided by your institution after installation.
          </div>
        </aside>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Nisaab360 Mobile App",
          operatingSystem: "Android",
          applicationCategory: "EducationalApplication",
          downloadUrl: "https://nisaab360.app/api/download-app",
          description: "Official Nisaab360 Android app for attendance, marks, timetables, and school updates.",
        }) }}
      />
    </main>
  );
}
