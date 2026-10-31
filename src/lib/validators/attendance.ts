import { z } from 'zod';
import { pakistanDateKey } from '@/lib/parent-period';

export const studentAttendanceSchema = z.object({
  sectionId: z.number().int().positive(),
  date: z.union([z.iso.date(), z.iso.datetime({ offset: true })])
    .transform(value => value.includes('T') ? pakistanDateKey(value) : value),
  records: z.array(z.object({
    studentId: z.number().int().positive(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
  })).min(1, 'Select at least one student.').max(10000),
}).refine(data => new Set(data.records.map(record => record.studentId)).size === data.records.length, {
  path: ['records'], message: 'Each student must appear only once.',
});

export const attendanceDelegationSchema = z.object({
  sectionId: z.number().int().positive(),
  date: z.iso.date(),
  staffId: z.number().int().positive().nullable(),
});

export const staffAttendanceSchema = z.object({
  date: z.iso.date(),
  records: z.array(z.object({
    staffId: z.coerce.number().int().positive(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
  })).min(1, 'Mark attendance for at least one staff member.'),
}).refine(data => new Set(data.records.map(record => record.staffId)).size === data.records.length, {
  path: ['records'], message: 'Each staff member must appear only once.',
});
