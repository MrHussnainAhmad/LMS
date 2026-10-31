import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { attendanceDelegations, staff } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { getAttendanceRoster, getAttendanceSections } from '@/lib/student-attendance';
import { pakistanDateKey } from '@/lib/parent-period';
import { AttendanceClient } from '@/app/(staff)/staff/attendance/AttendanceClient';
import { DelegationForm } from './DelegationForm';

export default async function StudentAttendancePage({ searchParams }: {
  searchParams: Promise<{ sectionId?: string; date?: string }>;
}) {
  const session = await getSession();
  if (!session || !['INSTITUTION', 'INSTITUTION_ADMIN'].includes(session.role) || !session.institutionId) redirect('/login');
  if (session.campusReadOnly) return <p>This campus is read-only. Switch back to your own campus to manage attendance.</p>;
  const institutionId = session.institutionId;
  const params = await searchParams;
  const today = pakistanDateKey();
  const parsedDate = z.iso.date().safeParse(params.date);
  const date = parsedDate.success ? parsedDate.data : today;
  const assignedSections = await getAttendanceSections(session);
  const section = assignedSections.find(row => row.id === Number(params.sectionId)) ?? assignedSections[0];
  if (!section) return <p>Create a class and section in Academics before managing student attendance.</p>;
  const [roster, activeStaff, delegation] = await Promise.all([
    getAttendanceRoster(institutionId, section.id, today),
    db.select({ id: staff.id, name: staff.name }).from(staff).where(and(eq(staff.institutionId, institutionId), eq(staff.isActive, true), isNull(staff.deletedAt))).orderBy(staff.name),
    db.select({ staffId: attendanceDelegations.staffId }).from(attendanceDelegations).where(and(
      eq(attendanceDelegations.institutionId, institutionId), eq(attendanceDelegations.sectionId, section.id),
      eq(attendanceDelegations.date, date), isNull(attendanceDelegations.revokedAt),
    )),
  ]);
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Student Attendance</h1>
    <form className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-sm font-medium">Class / section
        <select name="sectionId" defaultValue={section.id} className="block rounded-md border border-border bg-surface p-2">
          {assignedSections.map(row => <option key={row.id} value={row.id}>{row.className} — {row.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">Substitute date
        <input type="date" name="date" defaultValue={date} className="block rounded-md border border-border bg-surface p-2" />
      </label>
      <button className="rounded-md border border-border px-4 py-2 text-sm" type="submit">View</button>
    </form>
    <section className="rounded-lg border border-border bg-surface p-5 space-y-3">
      <h2 className="text-lg font-semibold">Temporary attendance substitute</h2>
      <DelegationForm key={`${section.id}:${date}:${delegation[0]?.staffId ?? 'none'}`} sectionId={section.id}
        date={date} today={today} currentStaffId={delegation[0]?.staffId ?? null} staff={activeStaff} />
    </section>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Mark today’s attendance — {today}</h2>
      <p className="text-sm text-stone-600">As an institution administrator, you can mark attendance here when the incharge or substitute is unavailable. Saved records show who marked them.</p>
      <AttendanceClient key={`${section.id}:${today}`} assignedSections={[section]} initialSectionId={section.id}
        initialStudents={roster.students} initialAlreadyMarked={roster.alreadyMarkedToday}
        attendanceDate={today} rosterEndpoint="/api/institution/attendance" />
    </section>
  </div>;
}
