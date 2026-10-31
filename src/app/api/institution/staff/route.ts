import { readBoundedJson } from '@/lib/http';
import { inputErrorResponse } from '@/lib/input-error-response';
import { validationError } from '@/lib/validation-errors';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staff, campuses, institutionCustomRoles } from '@/db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import { requireRole, getTenantContext } from '@/lib/rbac';
import { createStaffSchema } from '@/lib/validators/staff';
import { logAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/client-ip';
import { createStaffAccount } from '@/lib/user';

// Lightweight staff options list (id + name only) for dropdowns like the class-teacher
// select on the Add Section form. Fetched lazily on the client, never joined with requests.
import { getCachedOrFetch, invalidateStaffReadCaches } from '@/lib/redis';

export const GET = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').trim();
  const campusIdParam = url.searchParams.get('campusId');
  const campusId = campusIdParam ? Number(campusIdParam) : null;

  const conditions = [eq(staff.isActive, true)];
  if (Number.isInteger(campusId)) {
    conditions.push(eq(staff.campusId, campusId as number));
  }
  if (query) {
    conditions.push(or(
      ilike(staff.name, `%${query}%`),
      ilike(staff.email, `%${query}%`)
    )!);
  }

  const fetchRows = () => db.select({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    campus: campuses.name,
    role: institutionCustomRoles.name,
  })
    .from(staff)
    .leftJoin(campuses, eq(staff.campusId, campuses.id))
    .leftJoin(institutionCustomRoles, eq(staff.customRoleId, institutionCustomRoles.id))
    .where(and(eq(staff.institutionId, tenantId), ...conditions))
    .orderBy(staff.name);

  // Cache common dropdown reads only; arbitrary searches do not fill the keyspace.
  const rows = query ? await fetchRows() : await getCachedOrFetch(
    `cache:staff-options:${tenantId}:${Number.isInteger(campusId) ? campusId : 'all'}`, 30, fetchRows,
  );
  return NextResponse.json({ staff: rows }, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = requireRole(['INSTITUTION', 'INSTITUTION_ADMIN'], async (req: NextRequest, { session }) => {
  const tenantId = getTenantContext(session);
  const body = await readBoundedJson(req);
  const parsed = createStaffSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const { name, phone, subjectIds, campusId: requestedCampusId, customRoleId } = parsed.data;
  const campusId = session.campusId ?? requestedCampusId;
  if (requestedCampusId && requestedCampusId !== campusId) return NextResponse.json({ error: 'Select your own campus.' }, { status: 400 });
  try {
    const newStaff = await createStaffAccount(tenantId, { name, phone, subjectIds, campusId: campusId ?? undefined, customRoleId });

    await logAudit({
      institutionId: tenantId,
      actorId: session.userId,
      actorRole: session.role,
      action: 'CREATE_STAFF',
      target: `Staff ${newStaff.id}`,
      ip: getClientIp(req),
    });

    await invalidateStaffReadCaches(tenantId);

    return NextResponse.json({ 
      message: 'Staff created successfully', 
      credentials: { email: newStaff.email, initialPassword: newStaff.initialPassword }
    }, { status: 201 });
  } catch (err) {
    const publicInputError = inputErrorResponse(err);
    if (publicInputError) return NextResponse.json(publicInputError.body, { status: publicInputError.status });

    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
