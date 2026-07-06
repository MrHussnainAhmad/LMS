import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  subjectIds: z.array(z.number()).min(1),
  campusId: z.number().optional(),
}).strict();
