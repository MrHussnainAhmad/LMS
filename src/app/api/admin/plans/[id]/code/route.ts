import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { generateDealtCode, PlanError } from '@/lib/plan-management';

export const POST = requireRole(['SUPER_ADMIN'], async (_req, { params }) => {
  try { return NextResponse.json(await generateDealtCode((await params).id), { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } }); }
  catch (error) { if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
}, { permission: 'platform.accounts' });
