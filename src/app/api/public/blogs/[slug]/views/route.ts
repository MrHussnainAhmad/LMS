import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { blogs } from '@/db/schema';
import { withApiPolicy } from '@/lib/api-policy';
import { withRateLimit } from '@/lib/rate-limit';

export const POST = withApiPolicy(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const headers = { 'Cache-Control': 'no-store' };
  const limited = await withRateLimit(req, 'api', 'blog-views');
  if (!limited.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...headers, 'Retry-After': String(limited.retryAfterSeconds) } });
  const { slug } = await params;
  if (!slug || slug.length > 255) return NextResponse.json({ error: 'Article not found' }, { status: 404, headers });
  const [post] = await db.update(blogs)
    .set({ viewCount: sql`${blogs.viewCount} + 1` })
    .where(and(eq(blogs.slug, slug), eq(blogs.status, 'PUBLISHED')))
    .returning({ views: blogs.viewCount });
  if (!post) return NextResponse.json({ error: 'Article not found' }, { status: 404, headers });
  return NextResponse.json(post, { headers });
});
