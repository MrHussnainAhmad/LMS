import type { NextRequest } from 'next/server';
import { revokeQrLoginSession } from '@/lib/qr-login';
import { assertQrBrowserMutation, qrHandler, qrJson, qrLimit, qrOwner } from '@/lib/qr-login-http';
export const runtime = 'nodejs';
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return qrHandler(async () => {
    assertQrBrowserMutation(req);
    const owner = await qrOwner(req);
    const limited = await qrLimit(req, 'revoke', owner);
    if (limited) return limited;
    const id=(await context.params).id;
    const result=await revokeQrLoginSession(owner,id);
    await (await import('@/lib/notification-events')).notifySecurity({institutionId:owner.payload.institutionId!,userRole:owner.payload.role as 'STUDENT'|'STAFF',userId:owner.payload.userId},'A QR mobile session was revoked from your account.',`qr-revoked:${id}`);
    return qrJson(result);
  });
}
