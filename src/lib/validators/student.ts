import { z } from 'zod';

export const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  campusId: z.coerce.number().min(1),
  classId: z.coerce.number().min(1),
  sectionId: z.coerce.number().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  yearOfJoining: z.coerce.number().min(2000).max(2100),
  classRollNumber: z.string().min(1),
  age: z.coerce.number().optional(),
});
