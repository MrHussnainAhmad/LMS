import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { institutionBackups } from '@/db/schema';
import { requireRole } from '@/lib/rbac';
import { count, desc, eq } from 'drizzle-orm';

export const GET = requireRole(['SUPER_ADMIN', 'EMPLOYEE'], async (req: NextRequest) => {
  const institutionId = Number.parseInt(req.nextUrl.searchParams.get('institutionId') || '', 10);
  if (!Number.isInteger(institutionId) || institutionId <= 0) return NextResponse.json({ error: 'Valid institutionId is required' }, { status: 400 });
  const page = Math.max(Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1, 1);
  // Covers the normal 30 daily + 12 monthly versions plus manual/export jobs
  // without forcing the operator through pagination during a recovery incident.
  const limit = 100;
  const where = eq(institutionBackups.institutionId, institutionId);
  const [items, totalRows] = await Promise.all([
    db.select().from(institutionBackups).where(where).orderBy(desc(institutionBackups.createdAt)).limit(limit).offset((page - 1) * limit),
    db.select({ value: count() }).from(institutionBackups).where(where),
  ]);
  return NextResponse.json({ items, total: totalRows[0]?.value ?? 0, page, limit }, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = requireRole(['SUPER_ADMIN', 'EMPLOYEE'], async () => NextResponse.json({error:'Manual institution backup controls have been replaced by full database backups. School-owned scheduled Drive backups continue.'},{status:410}));
