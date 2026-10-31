import { requireRole } from '@/lib/rbac';
import { attendanceGet, attendancePost } from '@/lib/attendance-http';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], attendanceGet);
export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], attendancePost);
