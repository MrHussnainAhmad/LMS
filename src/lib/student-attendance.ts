import { and, eq, exists, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attendanceDelegations, attendances, classes, institutionAdmins, institutions, sections, staff, students } from '@/db/schema';
import type { JWTPayload } from './auth-types';
import { ActionInputError } from './action-input-error';
import { assertCampusWritable } from './campus-view';
import { pakistanDateKey } from './parent-period';
import { attendanceDelegationSchema, studentAttendanceSchema } from './validators/attendance';

type Connection = Pick<typeof db, 'select' | 'insert' | 'update'>;
export class AttendanceError extends ActionInputError {
  constructor(message: string, public status = 400) { super(message); }
}

export function attendanceInstitution(session: JWTPayload) {
  if (session.mustChangePassword) throw new AttendanceError('Change your password before continuing.', 403);
  if (!['STAFF', 'INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role) || !session.institutionId) {
    throw new AttendanceError('Forbidden', 403);
  }
  return session.institutionId;
}

function staffAccess(institutionId: number, staffId: number, date: string, connection: Connection) {
  return or(eq(sections.classTeacherId, staffId), exists(connection.select({ id: attendanceDelegations.id })
    .from(attendanceDelegations).innerJoin(staff, eq(staff.id, attendanceDelegations.staffId)).where(and(
      eq(attendanceDelegations.institutionId, institutionId), eq(attendanceDelegations.sectionId, sections.id),
      eq(attendanceDelegations.staffId, staffId), eq(attendanceDelegations.date, date), isNull(attendanceDelegations.revokedAt),
      eq(staff.institutionId, institutionId), eq(staff.isActive, true), isNull(staff.deletedAt),
    ))));
}

export async function getAttendanceSections(session: JWTPayload, date = pakistanDateKey()) {
  const institutionId = attendanceInstitution(session);
  return db.select({ id: sections.id, name: sections.name, classId: sections.classId, className: classes.name })
    .from(sections).innerJoin(classes, eq(classes.id, sections.classId)).where(and(
      eq(sections.institutionId, institutionId), eq(classes.institutionId, institutionId),
      isNull(sections.deletedAt), isNull(classes.deletedAt),
      session.role === 'STAFF' ? staffAccess(institutionId, session.userId, date, db) : undefined,
    )).orderBy(classes.name, sections.name);
}

// Writes and delegation changes take the same section lock. A revocation that
// commits first cannot race with a stale authorization check during submission.
export async function authorizeStudentAttendance(session: JWTPayload, sectionId: number, date: string,
  connection: Connection = db, lock = false) {
  if (lock) assertCampusWritable(session);
  const institutionId = attendanceInstitution(session);
  const query = connection.select({ id: sections.id }).from(sections).where(and(
    eq(sections.institutionId, institutionId), eq(sections.id, sectionId), isNull(sections.deletedAt),
  ));
  const [section] = await (lock ? query.for('update') : query);
  if (!section) throw new AttendanceError('Section not found.', 404);
  if (session.role === 'STAFF') {
    const [allowed] = await connection.select({ id: sections.id }).from(sections).where(and(
      eq(sections.id, sectionId), staffAccess(institutionId, session.userId, date, connection),
    ));
    if (!allowed) throw new AttendanceError('Only the Class Incharge or the substitute assigned for this date can mark attendance.', 403);
  }
  return institutionId;
}

export async function attendanceMarker(session: JWTPayload, connection: Connection = db) {
  const institutionId = attendanceInstitution(session);
  let name: string | undefined;
  if (session.role === 'STAFF') {
    const [actor] = await connection.select({ name: staff.name }).from(staff).where(and(
      eq(staff.id, session.userId), eq(staff.institutionId, institutionId), eq(staff.isActive, true), isNull(staff.deletedAt),
    ));
    name = actor?.name;
  } else if (session.role === 'INSTITUTION_ADMIN') {
    const [actor] = await connection.select({ name: institutionAdmins.name }).from(institutionAdmins).where(and(
      eq(institutionAdmins.id, session.userId), eq(institutionAdmins.institutionId, institutionId),
    ));
    name = actor?.name;
  } else if (session.userId === institutionId) {
    const [actor] = await connection.select({ name: institutions.name }).from(institutions).where(eq(institutions.id, institutionId));
    name = actor?.name;
  }
  if (!name) throw new AttendanceError('Attendance account is no longer available.', 403);
  return { markedByRole: session.role, markedById: session.userId, markedByName: name, markedAt: new Date() };
}

export async function saveStudentAttendance(session: JWTPayload, input: unknown) {
  const { sectionId, date, records } = studentAttendanceSchema.parse(input);
  if (date !== pakistanDateKey()) throw new AttendanceError('Attendance can only be marked for today. Reload the page.', 409);
  const institutionId = attendanceInstitution(session);
  const marker = await db.transaction(async tx => {
    await authorizeStudentAttendance(session, sectionId, date, tx, true);
    if (date !== pakistanDateKey()) throw new AttendanceError('The attendance date has changed. Reload the page.', 409);
    const eligible = await tx.select({ id: students.id }).from(students).where(and(
      eq(students.institutionId, institutionId), eq(students.sectionId, sectionId),
      eq(students.isActive, true), eq(students.academicStatus, 'ACTIVE'), isNull(students.deletedAt),
      inArray(students.id, records.map(record => record.studentId)),
    ));
    if (eligible.length !== records.length) throw new AttendanceError('Attendance includes students outside this section or inactive students. Reload the roster.');
    const marker = await attendanceMarker(session, tx);
    await tx.insert(attendances).values(records.map(record => ({ institutionId, sectionId, date, ...record, ...marker })))
      .onConflictDoUpdate({ target: [attendances.studentId, attendances.date],
        set: { status: sql`excluded.status`, sectionId, ...marker },
        setWhere: eq(attendances.institutionId, institutionId),
      });
    return marker;
  });
  return { institutionId, sectionId, date, records, marker };
}

export async function saveAttendanceDelegation(session: JWTPayload, input: unknown) {
  const institutionId = attendanceInstitution(session);
  if (session.role === 'STAFF') throw new AttendanceError('Forbidden', 403);
  const { sectionId, date, staffId } = attendanceDelegationSchema.parse(input);
  if (date < pakistanDateKey()) throw new AttendanceError('Choose today or a future date.');
  await db.transaction(async tx => {
    await authorizeStudentAttendance(session, sectionId, date, tx, true);
    if (staffId === null) {
      await tx.update(attendanceDelegations).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(
        eq(attendanceDelegations.institutionId, institutionId), eq(attendanceDelegations.sectionId, sectionId), eq(attendanceDelegations.date, date),
      ));
      return;
    }
    const [substitute] = await tx.select({ id: staff.id }).from(staff).where(and(
      eq(staff.id, staffId), eq(staff.institutionId, institutionId), eq(staff.isActive, true), isNull(staff.deletedAt),
    ));
    if (!substitute) throw new AttendanceError('Select an active staff member from this institution.');
    const assignment = { staffId, assignedByRole: session.role, assignedById: session.userId, revokedAt: null, updatedAt: new Date() };
    await tx.insert(attendanceDelegations).values({ institutionId, sectionId, date, ...assignment })
      .onConflictDoUpdate({ target: [attendanceDelegations.sectionId, attendanceDelegations.date], set: assignment,
        setWhere: eq(attendanceDelegations.institutionId, institutionId) });
  });
  return { success: true };
}

export async function getAttendanceRoster(institutionId: number, sectionId: number, date: string) {
  const rows = await db.select({ id: students.id, name: students.name, loginRollNumber: students.loginRollNumber,
    sectionId: students.sectionId, status: attendances.status, markedByName: attendances.markedByName,
    markedByRole: attendances.markedByRole, markedAt: attendances.markedAt,
  }).from(students).leftJoin(attendances, and(eq(attendances.studentId, students.id),
    eq(attendances.institutionId, institutionId), eq(attendances.date, date))).where(and(
    eq(students.institutionId, institutionId), eq(students.sectionId, sectionId),
    eq(students.isActive, true), eq(students.academicStatus, 'ACTIVE'), isNull(students.deletedAt),
  )).orderBy(students.name);
  return { students: rows, alreadyMarkedToday: rows.length > 0 && rows.every(row => row.status !== null) };
}
