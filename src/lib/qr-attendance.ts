import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attendances, sections, students } from '@/db/schema';
import { readStudentVerificationToken } from './student-verification-token';

export type AttendanceScope = { institutionId: number; staffId: number; sectionId: number };

export class QrAttendanceError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Parse locally: a scanned URL is never opened or fetched by the attendance API. */
export function readAttendanceQr(qr: string) {
  try {
    const url = new URL(qr);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/verify/student' || url.searchParams.getAll('token').length !== 1) return null;
    return readStudentVerificationToken(url.searchParams.get('token') || '');
  } catch { return null; }
}

export async function authorizeAttendanceSection(scope: AttendanceScope) {
  const [section] = await db.select({ id: sections.id }).from(sections).where(and(
    eq(sections.id, scope.sectionId), eq(sections.institutionId, scope.institutionId),
    eq(sections.classTeacherId, scope.staffId),
  )).limit(1);
  if (!section) throw new QrAttendanceError('Only the designated Class Incharge can mark this section.', 403);
}

function eligibleStudents(scope: AttendanceScope) {
  return and(eq(students.institutionId, scope.institutionId), eq(students.sectionId, scope.sectionId),
    eq(students.isActive, true), eq(students.academicStatus, 'ACTIVE'), isNull(students.deletedAt));
}

export async function getQrAttendanceSnapshot(scope: AttendanceScope, date: string) {
  const rows = await db.select({ id: students.id, status: attendances.status }).from(students)
    .leftJoin(attendances, and(eq(attendances.studentId, students.id),
      eq(attendances.institutionId, scope.institutionId), eq(attendances.date, date)))
    .where(eligibleStudents(scope));
  return { date, total: rows.length, presentStudentIds: rows.filter(row => row.status === 'PRESENT').map(row => row.id) };
}

export async function markQrAttendance(scope: AttendanceScope, date: string, qr: string) {
  const identity = readAttendanceQr(qr);
  if (!identity || identity.institutionId !== scope.institutionId) {
    throw new QrAttendanceError('Invalid student ID card for your institution.', 400);
  }
  const [student] = await db.select({ id: students.id, name: students.name, campusId: students.campusId, createdAt: students.createdAt,
    status: attendances.status }).from(students)
    .leftJoin(attendances, and(eq(attendances.studentId, students.id),
      eq(attendances.institutionId, scope.institutionId), eq(attendances.date, date)))
    .where(and(eligibleStudents(scope), eq(students.id, identity.studentId))).limit(1);
  if (!student || student.createdAt.getTime() !== identity.createdAt) {
    throw new QrAttendanceError('This student is not active in the selected section, or the card is no longer valid.', 404);
  }
  // Common duplicate path performs no write and triggers no cache/notification work.
  if (student.status === 'PRESENT') return { student: { id: student.id, name: student.name }, campusId: student.campusId, alreadyPresent: true };

  const changed = await db.insert(attendances).values({ institutionId: scope.institutionId,
    sectionId: scope.sectionId, studentId: student.id, date, status: 'PRESENT' })
    .onConflictDoUpdate({ target: [attendances.studentId, attendances.date],
      set: { status: 'PRESENT', sectionId: scope.sectionId },
      setWhere: and(eq(attendances.institutionId, scope.institutionId), ne(attendances.status, 'PRESENT')),
    }).returning({ id: attendances.studentId });
  return { student: { id: student.id, name: student.name }, campusId: student.campusId, alreadyPresent: changed.length === 0 };
}

export async function finalizeQrAttendance(scope: AttendanceScope, date: string) {
  // One INSERT ... SELECT, no per-student writes. Conflicts never downgrade PRESENT,
  // including a concurrent scan arriving before or after this statement.
  // Explicit insert columns let PostgreSQL supply id/created_at defaults; Drizzle's
  // insert-select builder requires every table column, including default columns.
  const result = await db.execute<{ studentId: number; status: 'ABSENT' }>(sql`
    INSERT INTO ${attendances} (institution_id, section_id, student_id, date, status)
    SELECT ${scope.institutionId}, ${scope.sectionId}, ${students.id}, ${date}::date, 'ABSENT'::attendance_status
    FROM ${students} WHERE ${eligibleStudents(scope)} ORDER BY ${students.id}
    ON CONFLICT (student_id, date) DO UPDATE SET status = 'ABSENT', section_id = excluded.section_id
    WHERE ${attendances.institutionId} = ${scope.institutionId}
      AND ${attendances.status} NOT IN ('PRESENT', 'ABSENT')
    RETURNING student_id AS "studentId", status
  `);
  return result.rows;
}
