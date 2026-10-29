import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/http';
import { withDealCodeRateLimit } from '@/lib/rate-limit';
import { resolveDealtPlan, PlanError } from '@/lib/plan-management';

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  const limited = await withDealCodeRateLimit(req);
  if (!limited.success) return NextResponse.json({ error: 'Too many code checks or verification is temporarily unavailable. Please try again later.' }, { status: 429, headers });
  const body = await readJsonBody<{ code?: unknown }>(req, 1024);
  if (!body.ok || typeof body.data?.code !== 'string') return NextResponse.json({ error: 'Enter the five-character code supplied by your admin.' }, { status: 400, headers });
  try { return NextResponse.json({ plan: await resolveDealtPlan(body.data.code.trim().toUpperCase()) }, { headers }); }
  catch (error) { if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: error.status, headers }); throw error; }
}
