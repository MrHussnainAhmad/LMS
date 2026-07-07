import { notFound } from "next/navigation";
import { db } from "@/db";
import { platformPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const [page] = await db.select().from(platformPages).where(eq(platformPages.slug, params.slug));
  
  if (!page) {
    return { title: "Page Not Found | Taleem360" };
  }

  return {
    title: `${page.title} | Taleem360`,
    description: `Read the ${page.title} for Taleem360.`,
  };
}

export const dynamic = "force-dynamic";

export default async function StaticPage({ params }: { params: { slug: string } }) {
  const [page] = await db.select().from(platformPages).where(eq(platformPages.slug, params.slug));

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCFB] selection:bg-brand-500 selection:text-white">
      <header className="sticky top-0 z-50 flex items-center px-6 md:px-12 py-4 backdrop-blur-2xl bg-white/60 border-b border-stone-200/50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="bg-brand-600 p-2 rounded-xl group-hover:bg-brand-700 transition-colors flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="font-display font-extrabold text-xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Taleem360</span>
        </Link>
        <Link href="/" className="ml-auto text-sm font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 md:py-24">
        <article className="prose prose-stone md:prose-lg lg:prose-xl max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand-600 hover:prose-a:text-brand-700 prose-img:rounded-2xl">
          <h1 className="mb-8">{page.title}</h1>
          <div className="text-sm text-stone-500 mb-12 uppercase tracking-wider font-semibold">
            Last updated: {new Date(page.updatedAt).toLocaleDateString()}
          </div>
          <ReactMarkdown>{page.content}</ReactMarkdown>
        </article>
      </main>

      <footer className="w-full bg-white border-t border-stone-200 py-10 px-6 text-center">
        <p className="text-stone-400 text-sm">&copy; {new Date().getFullYear()} Taleem360 Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
