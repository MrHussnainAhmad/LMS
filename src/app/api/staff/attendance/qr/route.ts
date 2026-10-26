import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/rbac';
import { readJsonBody } from '@/lib/http';
import { pakistanDateKey } from '@/lib/parent-period';
import { invalidateStudentAttendanceCaches } from '@/lib/redis';
import { createAttendanceNotifications } from '@/lib/notifications';
import { authorizeAttendanceSection, finalizeQrAttendance, getQrAttendanceSnapshot,
  markQrAttendance, QrAttendanceError } from '@/lib/qr-attendance';
export { corsPreflight as OPTIONS } from '@/lib/cors';

const MAX_BODY_BYTES = 2048;
const sectionIdSchema = z.number().int().positive().max(2147483647);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('scan'), sectionId: sectionIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), qr: z.string().min(1).max(1024) }).strict(),
  z.object({ action: z.literal('finalize'), sectionId: sectionIdSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
]);
const headers = { 'Cache-Control': 'no-store' };

function failure(error: unknown) {
  if (error instanceof QrAttendanceError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  throw error;
}

export const GET = requireRole(['STAFF'], async (req: NextRequest, { session }) => {
  const parsed = sectionIdSchema.safeParse(Number(req.nextUrl.searchParams.get('sectionId')));
  if (!parsed.success || !session.institutionId) return NextResponse.json({ error: 'Select a valid class section.' }, { status: 400, headers });
  const scope = { institutionId: session.institutionId, staffId: session.userId, sectionId: parsed.data };
  try {
    await authorizeAttendanceSection(scope);
    return NextResponse.json(await getQrAttendanceSnapshot(scope, pakistanDateKey()), { headers });
  } catch (error) { return failure(error); }
});

export const POST = requireRole(['STAFF'], async (req: NextRequest, { session }) => {
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status, headers });
  const parsed = requestSchema.safeParse(body.data);
  if (!parsed.success || !session.institutionId) return NextResponse.json({ error: 'Invalid scanner request.' }, { status: 400, headers });
  const input = parsed.data;
  const date = pakistanDateKey();
  if (input.date !== date) return NextResponse.json({ error: 'The attendance date has changed. Close and reopen the scanner for today.' }, { status: 409, headers });
  const scope = { institutionId: session.institutionId, staffId: session.userId, sectionId: input.sectionId };
  try {
    await authorizeAttendanceSection(scope);
    if (input.action === 'scan') {
      const { campusId, ...result } = await markQrAttendance(scope, date, input.qr);
      if (!result.alreadyPresent) await invalidateStudentAttendanceCaches(scope.institutionId, [result.student.id], { ...scope, date, campusId });
      return NextResponse.json({ ...result, date }, { headers });
    }
    const records = await finalizeQrAttendance(scope, date);
    if (records.length) {
      await invalidateStudentAttendanceCaches(scope.institutionId, records.map(record => record.studentId));
      after(async () => {
        try { await createAttendanceNotifications({ institutionId: scope.institutionId, date, records }); }
        catch (error) { console.error('QR attendance notifications failed:', error); }
      });
    }
    return NextResponse.json({ success: true, date, changed: records.length }, { headers });
  } catch (error) { return failure(error); }
}, { maxBodyBytes: MAX_BODY_BYTES });
