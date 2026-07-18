import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getBlog(slug: string) {
  const [blog] = await db.select().from(blogs).where(and(eq(blogs.slug, slug), eq(blogs.status, 'PUBLISHED'))).limit(1);
  return blog ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const blog = await getBlog(resolvedParams.slug);
  
  if (!blog) {
    return { title: "Blog Not Found | Nisaab360" };
  }

  // Use explicit meta tags, fallback to excerpt, fallback to content
  const desc = blog.metaDescription || blog.excerpt || blog.content.replace(/[#*`_>-]/g, "").substring(0, 160).trim() + "...";
  const title = blog.metaTitle || blog.title;

  return {
    title: `${title} | Nisaab360 Blog`,
    description: desc,
    alternates: {
      canonical: `https://blog.nisaab360.app/${resolvedParams.slug}`,
    },
    openGraph: {
      title: `${title} | Nisaab360 Blog`,
      description: desc,
      url: `https://blog.nisaab360.app/${resolvedParams.slug}`,
      type: "article",
      publishedTime: new Date(blog.publishedAt || blog.createdAt).toISOString(),
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const blog = await getBlog(resolvedParams.slug);

  if (!blog) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFCFB] selection:bg-brand-500 selection:text-white">
      <header className="sticky top-0 z-50 flex items-center px-6 md:px-12 py-4 backdrop-blur-2xl bg-white/60 border-b border-stone-200/50">
        <Link href="https://nisaab360.app" className="flex items-center gap-3 group">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-100 transition-transform group-hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo.png" alt="Nisaab360 logo" className="h-full w-full object-contain" />
          </div>
          <span className="font-display font-extrabold text-xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Nisaab360</span>
        </Link>
        <Link href="/" className="ml-auto text-sm font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-16 md:py-24">
        <article className="prose prose-stone md:prose-lg lg:prose-xl max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand-600 hover:prose-a:text-brand-700 prose-img:rounded-2xl">
          <h1 className="mb-6">{blog.title}</h1>
          <div className="flex items-center gap-4 text-sm text-stone-500 mb-12 font-medium border-b border-stone-200 pb-8">
            <span className="px-3 py-1 bg-stone-100 rounded-full">{blog.authorRole.replace('_', ' ')}</span>
            <time>Published on {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
          </div>
          <ReactMarkdown
            components={{
              ul: ({ children, ...props }) => (
                <ul className="my-5 list-disc space-y-2 pl-7 marker:text-brand-600" {...props}>
                  {children}
                </ul>
              ),
              ol: ({ children, ...props }) => (
                <ol className="my-5 list-decimal space-y-2 pl-7 marker:font-semibold marker:text-brand-600" {...props}>
                  {children}
                </ol>
              ),
              li: ({ children, ...props }) => (
                <li className="pl-1" {...props}>{children}</li>
              ),
            }}
          >
            {blog.content}
          </ReactMarkdown>
        </article>
      </main>

      <footer className="w-full bg-white border-t border-stone-200 py-6 sm:py-10 px-6 text-center mt-12">
        <p className="text-stone-400 text-sm">&copy; {new Date().getFullYear()} Nisaab360 Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
