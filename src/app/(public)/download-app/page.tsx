import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Download the Nisaab360 Android App",
  description: "Download the official Nisaab360 Android app for secure access to your school management system, attendance, marks, timetables, and announcements.",
  keywords: ["Nisaab360 Android app", "school management app Pakistan", "LMS Android app", "download Nisaab360"],
  alternates: { canonical: "/download-app" },
  openGraph: {
    title: "Download the Nisaab360 Android App",
    description: "Get the official Nisaab360 app for your school, staff, and students.",
    url: "/download-app",
    type: "website",
  },
};

export default function DownloadAppPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-stone-50 px-6 py-16">
      <section className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xl shadow-stone-900/5 sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
          <Smartphone className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Official Android app</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-stone-950 sm:text-4xl">Download Nisaab360</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-600">
          Access your timetable, attendance, marks, announcements, and school updates from the official Nisaab360 Android app.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full">
          <Link href="/api/download-app" prefetch={false}>
            <Download className="mr-2 h-5 w-5" />
            Download APK
          </Link>
        </Button>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-stone-500">
          <ShieldCheck className="h-4 w-4 text-success" />
          Only download the app from this official Nisaab360 page.
        </div>
        <Link href="/" className="mt-7 inline-block text-sm font-semibold text-brand-800 hover:underline">Back to Nisaab360</Link>
      </section>
    </main>
  );
}
