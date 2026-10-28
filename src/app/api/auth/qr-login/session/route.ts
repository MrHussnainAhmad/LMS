import type { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth-edge';
import { mobileAppAccessAllowed, MOBILE_APPS_DISABLED } from '@/lib/mobile-app-access';
import { qrHandler, qrJson } from '@/lib/qr-login-http';
export const runtime = 'nodejs';
/** Lightweight native heartbeat; signature verification also checks QR revocation. */
export async function GET(req: NextRequest) {
  return qrHandler(async () => {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload?.qrSessionId) return qrJson({ error: 'QR session expired or revoked.' }, 401);
    if (!await mobileAppAccessAllowed(payload, true)) return qrJson(MOBILE_APPS_DISABLED, 403);
    return qrJson({ status: 'ACTIVE', expiresAt: new Date(payload.qrSessionExpiresAt! * 1000).toISOString() });
  });
}
