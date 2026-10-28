import type { NextRequest } from 'next/server';
import { inspectQrLogin, QrLoginError, QR_LOGIN_ID_PATTERN } from '@/lib/qr-login';
import { assertQrBrowserMutation, qrHandler, qrJson, qrLimit, qrOwner } from '@/lib/qr-login-http';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

function handle(req: NextRequest, context: Context, revoke: boolean) {
  return qrHandler(async () => {
    if (revoke) assertQrBrowserMutation(req);
    const owner = await qrOwner(req);
    const limited = await qrLimit(req, revoke ? 'revoke' : 'status', owner);
    if (limited) return limited;
    const { id } = await context.params;
    if (!QR_LOGIN_ID_PATTERN.test(id)) throw new QrLoginError('Invalid QR login challenge identifier.', 400);
    return qrJson({ ...await inspectQrLogin(owner, id, revoke), serverTime: new Date().toISOString() });
  });
}
export const GET = (req: NextRequest, context: Context) => handle(req, context, false);
export const DELETE = (req: NextRequest, context: Context) => handle(req, context, true);
