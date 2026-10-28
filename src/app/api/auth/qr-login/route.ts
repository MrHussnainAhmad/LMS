import type { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { createQrLogin } from '@/lib/qr-login';
import { assertQrBrowserMutation, qrHandler, qrJson, qrLimit, qrOwner } from '@/lib/qr-login-http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return qrHandler(async () => {
    assertQrBrowserMutation(req);
    const owner = await qrOwner(req);
    const limited = await qrLimit(req, 'create', owner);
    if (limited) return limited;
    const challenge = await createQrLogin(owner);
    const qrImageDataUrl = await QRCode.toDataURL(challenge.qr, { errorCorrectionLevel: 'M', margin: 4, width: 320 });
    return qrJson({ ...challenge, qrImageDataUrl, serverTime: new Date().toISOString() }, 201);
  });
}
