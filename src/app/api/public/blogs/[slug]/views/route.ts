import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { blogs, blogVisits } from '@/db/schema';
import { readBoundedJson } from '@/lib/http';
import { z } from 'zod';
import { withApiPolicy } from '@/lib/api-policy';
import { withRateLimit } from '@/lib/rate-limit';

export const POST = withApiPolicy(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  const headers = { 'Cache-Control': 'no-store' };
  const limited = await withRateLimit(req, 'api', 'blog-views');
  if (!limited.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...headers, 'Retry-After': String(limited.retryAfterSeconds) } });
  const identity = z.object({ visitorId: z.string().uuid() }).safeParse(await readBoundedJson(req));
  if (!identity.success) return NextResponse.json({ error: 'Invalid visitor identity' }, { status: 400, headers });
  const { slug } = await params;
  if (!slug || slug.length > 255) return NextResponse.json({ error: 'Article not found' }, { status: 404, headers });
  const post = await db.transaction(async tx => {
    const [article] = await tx.select({ id: blogs.id }).from(blogs)
      .where(and(eq(blogs.slug, slug), eq(blogs.status, 'PUBLISHED'))).for('update').limit(1);
    if (!article) return null;
    await tx.insert(blogVisits).values({ blogId: article.id, visitorId: identity.data.visitorId.toLowerCase() }).onConflictDoNothing();
    const [total] = await tx.select({ views: sql<number>`count(*)::int` }).from(blogVisits).where(eq(blogVisits.blogId, article.id));
    return total;
  });
  if (!post) return NextResponse.json({ error: 'Article not found' }, { status: 404, headers });
  return NextResponse.json(post, { headers });
});
