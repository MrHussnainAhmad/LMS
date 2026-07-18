import { db } from "@/db";
import { blogs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: "Blog | Nisaab360 LMS",
  description: "Read the latest news, updates, and articles about Nisaab360 LMS.",
};

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = 4;
  const offset = (page - 1) * limit;

  const [publishedBlogs, [{ totalCount }]] = await Promise.all([
    db.select()
      .from(blogs)
      .where(eq(blogs.status, 'PUBLISHED'))
      .orderBy(desc(blogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ totalCount: sql<number>`cast(count(${blogs.id}) as integer)` })
      .from(blogs)
      .where(eq(blogs.status, 'PUBLISHED'))
  ]);

  const totalPages = Math.ceil(totalCount / limit);

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
        <Link href="https://nisaab360.app" className="ml-auto text-sm font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-16 md:py-24">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-stone-900 mb-4 flex items-center gap-3">
            <BookOpen className="w-10 h-10 text-brand-600" />
            Our Blog
          </h1>
          <p className="text-xl text-stone-500">Insights, updates, and stories from the Nisaab360 team.</p>
        </div>

        {publishedBlogs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 border-dashed">
            <p className="text-stone-500">No blog posts found. Check back later!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {publishedBlogs.map((post) => (
                <Link key={post.id} href={`/${post.slug}`} className="group bg-white rounded-2xl shadow-sm hover:shadow-xl border border-stone-100 transition-all duration-300 overflow-hidden flex flex-col">
                  <div className="p-4 sm:p-8 flex-1">
                    <h2 className="font-bold font-display tracking-tight text-2xl text-stone-900 mb-3 group-hover:text-brand-600 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-stone-500 line-clamp-3 mb-6">
                      {post.excerpt || post.content.replace(/[#*`_>-]/g, "").substring(0, 150) + '...'}
                    </p>
                  </div>
                  <div className="px-4 sm:px-8 py-4 bg-stone-50/50 border-t border-stone-100/50 flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-500">
                      {post.authorRole.replace('_', ' ')}
                    </span>
                    <time className="text-sm text-stone-400">
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </time>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                {page > 1 ? (
                  <Link href={`?page=${page - 1}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 border border-transparent text-stone-300 font-medium cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </div>
                )}
                
                <span className="text-sm font-medium text-stone-500">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link href={`?page=${page + 1}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 hover:text-stone-900 font-medium transition-colors">
                    Next <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 border border-transparent text-stone-300 font-medium cursor-not-allowed">
                    Next <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="w-full bg-white border-t border-stone-200 py-6 sm:py-10 px-6 text-center">
        <p className="text-stone-400 text-sm">&copy; {new Date().getFullYear()} Nisaab360 Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
