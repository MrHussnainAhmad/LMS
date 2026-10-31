import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAttendanceSections, getAttendanceRoster } from '@/lib/student-attendance';
import { pakistanDateKey } from '@/lib/parent-period';
import { AttendanceClient } from './AttendanceClient';

export default async function AttendancePage() {
  const session = await getSession();
  if (!session || session.role !== 'STAFF' || !session.institutionId) redirect('/login');
  const date = pakistanDateKey();
  const assignments = await getAttendanceSections(session, date);
  const sectionId = assignments[0]?.id ?? null;
  const roster = sectionId ? await getAttendanceRoster(session.institutionId, sectionId, date)
    : { students: [], alreadyMarkedToday: false };
  return <AttendanceClient assignedSections={assignments} initialSectionId={sectionId}
    initialStudents={roster.students} initialAlreadyMarked={roster.alreadyMarkedToday} attendanceDate={date} />;
}
