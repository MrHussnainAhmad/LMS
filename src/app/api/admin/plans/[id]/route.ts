import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { readJsonBody } from '@/lib/http';
import { removeManagedPlan, saveManagedPlan, PlanError } from '@/lib/plan-management';

export const PATCH = requireRole(['SUPER_ADMIN'], async (req, { session, params }) => {
  const { id } = await params;
  const body = await readJsonBody(req, 16_384);
  if (!body.ok) return NextResponse.json({ error: 'Invalid plan request.' }, { status: body.status });
  try { return NextResponse.json({ plan: await saveManagedPlan(body.data, session.userId, id) }); }
  catch (error) {
    if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { cause?: { code?: string } }).cause?.code === '23505') return NextResponse.json({ error: 'An active plan already uses that name.' }, { status: 409 });
    throw error;
  }
}, { permission: 'platform.accounts' });
export const DELETE = requireRole(['SUPER_ADMIN'], async (_req, { session, params }) => {
  const { id } = await params;
  try { await removeManagedPlan(id, session.userId); return NextResponse.json({ success: true }); }
  catch (error) { if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
}, { permission: 'platform.accounts' });
