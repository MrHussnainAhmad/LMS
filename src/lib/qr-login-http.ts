import { NextRequest, NextResponse } from 'next/server';
import { readQrOwner, QrLoginError, type QrOwner } from './qr-login';
import { withQrLoginRateLimit } from './rate-limit';
import { inputErrorResponse } from './input-error-response';

export const QR_LOGIN_HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export function qrJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: QR_LOGIN_HEADERS });
}

/** Exact origin, including port: a sibling subdomain sharing auth cookies is not trusted. */
export function assertQrBrowserMutation(req: NextRequest) {
  try {
    const origin = new URL(req.headers.get('origin') || '');
    const protocol = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
    if (req.headers.get('x-qr-login') !== '1' || !['http', 'https'].includes(protocol) ||
      origin.protocol !== `${protocol}:` || origin.host !== (req.headers.get('host') || req.nextUrl.host) ||
      !['same-origin', 'none', null].includes(req.headers.get('sec-fetch-site'))) throw new Error();
  } catch { throw new QrLoginError('Same-origin QR login request required.', 403); }
}

export async function qrOwner(req: NextRequest): Promise<QrOwner> {
  if (req.headers.has('authorization')) throw new QrLoginError('Use your authenticated web dashboard to manage QR login.', 403);
  return readQrOwner(req.cookies.get('access_token')?.value, req.cookies.get('refresh_token')?.value);
}

export async function qrLimit(req: NextRequest, operation: 'create' | 'redeem' | 'status' | 'revoke', owner?: QrOwner) {
  const result = await withQrLoginRateLimit(req, operation, owner ? `${owner.payload.role}:${owner.payload.userId}` : undefined);
  if (result.success) return null;
  const response = qrJson({ error: result.unavailable ? 'QR login is temporarily unavailable. Try again shortly.' : 'Too many QR login requests. Try again in one minute.' }, result.unavailable ? 503 : 429);
  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  return response;
}

export async function qrHandler(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    if (error instanceof QrLoginError) return qrJson({ error: error.message }, error.status);
    const inputError = inputErrorResponse(error);
    if (inputError) return qrJson(inputError.body, inputError.status);
    // Database errors can contain SQL parameters. Never log the exception or QR.
    console.error('[qr-login] Request failed; authentication was not completed.');
    return qrJson({ error: 'QR login is temporarily unavailable. Try again shortly.' }, 503);
  }
}
