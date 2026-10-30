import { z } from 'zod';
import { validateInstitutionSlug } from '@/lib/institution-domain';
import { SERVICE_AGREEMENT_VERSION } from '@/lib/service-agreement';

export const institutionPublicSlugSchema = z.string().transform((value, context) => {
  const validation = validateInstitutionSlug(value);
  if (!validation.ok) {
    context.addIssue({
      code: 'custom',
      message: validation.code === 'RESERVED'
        ? 'This subdomain is reserved'
        : 'Use 2-30 lowercase letters, numbers, or single hyphens; hyphens cannot be first or last',
    });
    return z.NEVER;
  }
  return validation.slug;
});

export const registerInstitutionSchema = z.object({
  name: z.string().min(2),
  mainCampusName: z.string().trim().min(2).max(255),
  type: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY']),
  username: z.string().min(3).max(30).regex(/^[a-z0-9]+$/, "Lowercase alphanumeric only"),
  country: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  contactEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  contactPhone: z.string().min(5),
  registrationNumber: z.string().min(2),
  pricingPlan: z.string().trim().min(1).max(20).regex(/^[A-Z0-9_]+$/),
  planRevision: z.number().int().positive(),
  dealCode: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{5}$/).optional(),
  agreementAccepted: z.literal(true, { error: 'You must accept the Service Agreement to register.' }),
  agreementVersion: z.literal(SERVICE_AGREEMENT_VERSION, { error: 'The Service Agreement has changed. Reload registration and read the current agreement before submitting.' }),
  agreementRepresentativeName: z.string().trim().min(2).max(255),
  adminPassword: z.string().min(8).max(1024).refine(value => value !== "1234567890", "Use a unique password"),
  // file metadata that client obtained from R2 upload
  logoKey: z.string().min(5),
  proofDocumentKey: z.string().min(5),
}).strict().superRefine((data, context) => {
  if (data.pricingPlan === 'DEALED' && !data.dealCode) context.addIssue({ code: 'custom', path: ['dealCode'], message: 'Enter and verify your Dealed code.' });
  if (data.pricingPlan !== 'DEALED' && data.dealCode) context.addIssue({ code: 'custom', path: ['dealCode'], message: 'Deal codes can only be used with Dealed.' });
});

export const reviewInstitutionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
}).strict();
