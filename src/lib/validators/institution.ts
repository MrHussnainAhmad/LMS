import { z } from 'zod';

export const registerInstitutionSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY']),
  username: z.string().min(3).max(30).regex(/^[a-z0-9]+$/, "Lowercase alphanumeric only"),
  country: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(5),
  registrationNumber: z.string().min(2),
  adminPassword: z.string().min(8),
  // file metadata that client obtained from R2 upload
  logoKey: z.string().min(5),
  proofDocumentKey: z.string().min(5),
}).strict();

export const reviewInstitutionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
}).strict();
