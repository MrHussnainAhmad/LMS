import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { platformPages } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { withApiPolicy } from '@/lib/api-policy';
import { getCachedOrFetch } from '@/lib/redis';

export const GET = withApiPolicy(async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

  const terms = await getCachedOrFetch('cache:platform:terms-notice', 30, async () => {
    const [page] = await db.select({ id: platformPages.id, updatedAt: platformPages.updatedAt })
      .from(platformPages).where(eq(platformPages.slug, 'terms-of-service')).limit(1);
    return page ? { revision: `${page.id}:${page.updatedAt.toISOString()}` } : null;
  });

  return NextResponse.json({
    terms,
    account: `${session.role}:${session.userId}`,
  }, { headers });
});
