import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().max(50).optional(),
  campusId: z.coerce.number().min(1).optional(),
  subjectIds: z.array(z.coerce.number().min(1)).default([]),
}).strict();

export const staffProfileChangeRequestSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  campusId: z.coerce.number().min(1).optional(),
  reason: z.string().trim().min(10).max(1000),
}).strict().refine((data) => {
  return Boolean(data.firstName || data.lastName || data.email || data.phone || data.campusId);
}, {
  message: "Select at least one profile field to update",
});

export const reviewStaffProfileChangeRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().trim().max(1000).optional(),
}).strict();
