import { NextRequest, NextResponse, after } from 'next/server';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { attendances, sections, students } from '@/db/schema';
import type { JWTPayload } from './auth-types';
import { attendanceInstitution, getAttendanceRoster, getAttendanceSections, saveStudentAttendance } from './student-attendance';
import { pakistanDateKey } from './parent-period';
import { readBoundedJson } from './http';
import { invalidateStudentAttendanceCaches } from './redis';
import { createAttendanceNotifications } from './notifications';

export async function attendanceGet(req: NextRequest, { session }: { session: JWTPayload }) {
  const institutionId = attendanceInstitution(session);
  const view = req.nextUrl.searchParams.get('view') === 'history' ? 'history' : 'mark';
  const requestedDate = req.nextUrl.searchParams.get('date');
  const date = requestedDate ? z.iso.date().parse(requestedDate) : pakistanDateKey();
  const rawSectionId = req.nextUrl.searchParams.get('sectionId');
  const sectionId = rawSectionId ? z.coerce.number().int().positive().parse(rawSectionId) : null;
  // Recheck access on every request so revoked substitutes lose access immediately.
  const assignedSections = await getAttendanceSections(session, view === 'history' ? date : pakistanDateKey());
  const available = sectionId ? assignedSections.filter(section => section.id === sectionId) : assignedSections;
  if (sectionId && !available.length) return NextResponse.json({ error: 'Forbidden: this section is not assigned to you.' }, { status: 403 });
  if (view === 'mark') {
    const selectedSectionId = available[0]?.id ?? null;
    const today = pakistanDateKey();
    const roster = selectedSectionId ? await getAttendanceRoster(institutionId, selectedSectionId, today)
      : { students: [], alreadyMarkedToday: false };
    return NextResponse.json({ assignedSections, selectedSectionId, date: today, ...roster }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const attendance = available.length ? await db.select({ id: attendances.id, date: attendances.date,
    status: attendances.status, studentName: students.name, sectionId: attendances.sectionId, sectionName: sections.name,
    markedByName: attendances.markedByName, markedByRole: attendances.markedByRole, markedById: attendances.markedById, markedAt: attendances.markedAt,
  }).from(attendances).innerJoin(students, eq(students.id, attendances.studentId))
    .innerJoin(sections, eq(sections.id, attendances.sectionId)).where(and(
      eq(attendances.institutionId, institutionId), inArray(attendances.sectionId, available.map(section => section.id)),
      requestedDate ? eq(attendances.date, date) : gte(attendances.date, pakistanDateKey(since)),
    )).orderBy(desc(attendances.date)) : [];
  return NextResponse.json({ attendance }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function attendancePost(req: NextRequest, { session }: { session: JWTPayload }) {
  const result = await saveStudentAttendance(session, await readBoundedJson(req));
  await invalidateStudentAttendanceCaches(result.institutionId, result.records.map(record => record.studentId));
  after(async () => {
    try { await createAttendanceNotifications(result); }
    catch (error) { console.error('Attendance notification delivery failed:', error); }
  });
  return NextResponse.json({ success: true });
}
