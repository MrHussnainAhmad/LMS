import { z } from 'zod';

export const createCampusSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
}).strict();

export const createClassSchema = z.object({
  name: z.string().min(1),
  level: z.number().default(0),
}).strict();

export const createSectionSchema = z.object({
  classId: z.number(),
  name: z.string().min(1),
  classTeacherId: z.number().optional(),
}).strict();

export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
}).strict();

export const assignStaffSchema = z.object({
  staffId: z.number(),
  sectionId: z.number(),
  subjectId: z.number(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, "Must be HH:mm"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, "Must be HH:mm"),
}).strict();

export const createAnnouncementSchema = z.object({
  targetType: z.enum(['ALL', 'CAMPUS', 'CLASS', 'SECTION']),
  targetCampusId: z.number().optional(),
  targetClassId: z.number().optional(),
  targetSectionId: z.number().optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
}).strict();

export const markAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  records: z.array(z.object({
    studentId: z.number(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']),
  })).min(1),
}).strict();

export const createTestSchema = z.object({
  sectionId: z.number(),
  subjectId: z.number(),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUIZ']),
  title: z.string().min(1),
  maxMarks: z.number().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
}).strict();

export const enterMarksSchema = z.object({
  testId: z.number(),
  records: z.array(z.object({
    studentId: z.number(),
    marksObtained: z.number().min(0),
  })).min(1),
}).strict();
