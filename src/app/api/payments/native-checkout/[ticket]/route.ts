import { NextResponse } from 'next/server';
import { consumeNativeCheckout, nativeCheckoutHtml, validNativeCheckoutTicket } from '@/lib/payments/native-checkout';
import { startPayment } from '@/lib/payments/service';
import { PaymentError } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ ticket: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { ticket } = await params;
  if (!validNativeCheckoutTicket(ticket)) return new Response('Checkout link is invalid.', { status: 410, headers: { 'Cache-Control': 'no-store' } });
  const page = nativeCheckoutHtml();
  return new Response(page.body, { headers: page.headers });
}

// Link previews and HEAD requests must never consume a payment capability.
export async function HEAD() { return new Response(null, { status: 405, headers: { Allow: 'GET, POST', 'Cache-Control': 'no-store' } }); }

export async function POST(_request: Request, { params }: Context) {
  try {
    const paymentId = await consumeNativeCheckout((await params).ticket);
    const result = await startPayment(paymentId, { phone: '', email: '' });
    if (!('checkout' in result)) throw new PaymentError('Checkout is not available.', 409);
    const page = nativeCheckoutHtml(result.checkout);
    const response = new NextResponse(page.body, { headers: page.headers });
    // This is a display hint only. The provider's signed response still verifies payment.
    response.cookies.set('nisaab360_native_payment', paymentId, { httpOnly: true, secure: true, sameSite: 'none', path: '/api/payments/jazzcash/return', maxAge: 1800 });
    return response;
  } catch (error) {
    const page = nativeCheckoutHtml(undefined, error instanceof PaymentError ? error.message : 'Checkout could not start. Return to the app and check payment status.');
    return new Response(page.body, { status: error instanceof PaymentError ? error.status : 503, headers: page.headers });
  }
}
