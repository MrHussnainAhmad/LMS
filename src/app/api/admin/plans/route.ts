import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { readJsonBody } from '@/lib/http';
import { listManagedPlans, saveManagedPlan, generateDealtCode, PlanError } from '@/lib/plan-management';

export const GET = requireRole(['SUPER_ADMIN'], async () => NextResponse.json({ plans: await listManagedPlans() }, { headers: { 'Cache-Control': 'private, no-store' } }), { permission: 'platform.accounts' });
export const POST = requireRole(['SUPER_ADMIN'], async (req, { session }) => {
  const body = await readJsonBody(req, 16_384);
  if (!body.ok) return NextResponse.json({ error: 'Invalid plan request.' }, { status: body.status });
  try {
    const plan = await saveManagedPlan(body.data, session.userId);
    const code = plan.kind === 'DEAL' ? await generateDealtCode(plan.id) : undefined;
    return NextResponse.json({ plan, code }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  }
  catch (error) {
    if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { cause?: { code?: string } }).cause?.code === '23505') return NextResponse.json({ error: 'An active plan already uses that name.' }, { status: 409 });
    throw error;
  }
}, { permission: 'platform.accounts' });
