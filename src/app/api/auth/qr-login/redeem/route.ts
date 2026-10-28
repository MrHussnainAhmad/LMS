import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { redeemQrLogin, QrLoginError } from '@/lib/qr-login';
import { qrHandler, qrJson, qrLimit } from '@/lib/qr-login-http';
import { AUTH_MAX_BODY_BYTES, readJsonBody } from '@/lib/http';
import { getClientIp } from '@/lib/client-ip';
import { logAudit } from '@/lib/audit';

export const runtime = 'nodejs';
const schema = z.object({ qr: z.string().max(160), roleHint: z.enum(['STUDENT', 'STAFF']).optional(), deviceName: z.string().trim().min(1).max(120).optional() }).strict();

export async function POST(req: NextRequest) {
  return qrHandler(async () => {
    // Native-only token exchange. Browser-origin requests cannot log another
    // browser into an attacker's account, even with a valid attacker-owned QR.
    if (req.headers.has('origin') || req.headers.get('sec-fetch-site') ||
      req.headers.has('authorization') || req.headers.get('x-qr-login') !== '1') {
      throw new QrLoginError('Use the mobile app to redeem QR login.', 403);
    }
    const limited = await qrLimit(req, 'redeem');
    if (limited) return limited;
    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return qrJson({ error: 'JSON request required.' }, 415);
    const body = await readJsonBody(req, AUTH_MAX_BODY_BYTES);
    if (!body.ok) return qrJson({ error: body.error }, body.status);
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) return qrJson({ error: 'Send a QR login code and an optional Student or Staff role hint.' }, 400);
    const { accessToken, refreshToken, payload } = await redeemQrLogin(parsed.data.qr, parsed.data.roleHint, parsed.data.deviceName);
    const ip = getClientIp(req);
    after(async () => { await (await import('@/lib/notification-events')).notifySecurity({institutionId:payload.institutionId!,userRole:payload.role as 'STUDENT'|'STAFF',userId:payload.userId},`Your account was signed in using QR Login on ${parsed.data.deviceName || 'a mobile device'}.`,payload.qrSessionId); });
    after(async () => {
      try { await logAudit({ institutionId: payload.institutionId, actorId: payload.userId, actorRole: payload.role, action: 'QR_LOGIN', target: 'Self', ip }); }
      catch { console.error('[qr-login] Login audit could not be recorded.'); }
    });
    // Same token issuer and JSON contract as password login with returnTokens.
    // This native-only exchange does not overwrite the originating web cookies.
    return qrJson({ message: 'Logged in successfully', role: payload.role, mustChangePassword: payload.mustChangePassword, accessToken, refreshToken });
  });
}
