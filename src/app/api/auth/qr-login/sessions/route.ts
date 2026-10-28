import type { NextRequest } from 'next/server';
import { listQrLoginSessions } from '@/lib/qr-login';
import { qrHandler, qrJson, qrLimit, qrOwner } from '@/lib/qr-login-http';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  return qrHandler(async () => {
    const owner = await qrOwner(req);
    const limited = await qrLimit(req, 'status', owner);
    if (limited) return limited;
    return qrJson({ sessions: await listQrLoginSessions(owner) });
  });
}
