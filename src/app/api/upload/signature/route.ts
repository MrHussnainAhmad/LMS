import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';

/** Direct provider signatures cannot enforce the application's byte ceiling. */
export const POST = requireRole(['STUDENT', 'STAFF', 'INSTITUTION', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'], async () => NextResponse.json({
  error: 'Update your application to use secure file uploads.',
  code: 'UPLOAD_CLIENT_UPDATE_REQUIRED',
  uploadUrl: '/api/upload/content',
}, { status: 410, headers: { 'Cache-Control': 'no-store' } }));
