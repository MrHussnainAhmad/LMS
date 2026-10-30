import { createHash, randomBytes } from 'node:crypto';
import { redis } from '@/lib/redis';
import { PaymentError } from './config';
import { paymentOrigin, endpointsReady } from './endpoints';
import { getPaymentAttempt } from './service';

const ticketPattern = /^[A-Za-z0-9_-]{43}$/;
const ticketKey = (ticket: string) => `payments:native-checkout:${createHash('sha256').update(ticket).digest('hex')}`;

/** Grants one hosted-checkout submission only; never a browser login session. */
export async function issueNativeCheckout(paymentId: string) {
  const payment = await getPaymentAttempt(paymentId);
  if ((payment.gateway !== 'jazzcash' && payment.gateway !== 'easypaisa') || !endpointsReady(payment.gateway, payment.environment)) throw new PaymentError('This gateway is unavailable pending a provider-approved secure integration.', 409);
  if (payment.gateway !== 'jazzcash' || payment.status !== 'PENDING' || payment.closedAt || payment.initiationStartedAt || payment.expiresAt <= new Date()) {
    throw new PaymentError('This payment cannot start again. Check its status first.', 409);
  }
  if (redis.status !== 'ready') throw new PaymentError('Checkout is temporarily unavailable. Please try again.', 503);
  const ticket = randomBytes(32).toString('base64url');
  const stored = await redis.set(ticketKey(ticket), paymentId, 'EX', 300, 'NX');
  if (stored !== 'OK') throw new PaymentError('Checkout is temporarily unavailable. Please try again.', 503);
  return { checkoutUrl: `${paymentOrigin()}/api/payments/native-checkout/${ticket}` };
}

export function validNativeCheckoutTicket(ticket: string) { return ticketPattern.test(ticket); }

export async function consumeNativeCheckout(ticket: string) {
  if (!validNativeCheckoutTicket(ticket)) throw new PaymentError('Checkout link is invalid or expired. Return to the app.', 410);
  if (redis.status !== 'ready') throw new PaymentError('Checkout is temporarily unavailable. Return to the app and try again.', 503);
  const paymentId = await redis.getdel(ticketKey(ticket));
  if (!paymentId) throw new PaymentError('Checkout link is invalid, expired or already used. Return to the app and check payment status.', 410);
  return paymentId;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function nativeCheckoutHtml(checkout?: { url: string; fields: Record<string, string> }, message?: string) {
  const nonce = randomBytes(18).toString('base64');
  const content = message ? `<h1>Return to Nisaab360</h1><p>${escapeHtml(message)}</p>`
    : checkout ? `<h1>Opening JazzCash</h1><form method="post" action="${escapeHtml(checkout.url)}">${Object.entries(checkout.fields).map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join('')}<button type="submit">Continue to JazzCash</button></form><script nonce="${nonce}">document.forms[0].submit()</script>`
    : '<h1>Pay with JazzCash</h1><p>Complete payment on JazzCash, then return to the app and check its status.</p><form method="post"><button type="submit">Continue to JazzCash</button></form>';
  return {
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Nisaab360 payment</title><style nonce="${nonce}">body{font:16px system-ui;max-width:36rem;margin:4rem auto;padding:1.5rem;line-height:1.6}button{font:inherit;padding:.75rem 1.5rem;cursor:pointer}</style></head><body>${content}</body></html>`,
    headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; form-action ${checkout ? new URL(checkout.url).origin : "'self'"}`,
    },
  };
}
