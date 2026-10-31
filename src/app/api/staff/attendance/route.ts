import { requireRole } from '@/lib/rbac';
import { attendanceGet, attendancePost } from '@/lib/attendance-http';

export const GET = requireRole(['STAFF'], attendanceGet);
export const POST = requireRole(['STAFF'], attendancePost);
