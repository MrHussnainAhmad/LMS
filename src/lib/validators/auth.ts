import { z } from 'zod';

/**
 * Upper bounds are far above any legitimate value; they exist so a single request
 * cannot hand a multi-megabyte string to argon2 (memory-hard, and marshalled
 * across a worker_threads boundary) or into a Valkey rate-limit key.
 */
const MAX_IDENTIFIER = 255;
const MAX_PASSWORD = 1024;

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1).max(MAX_IDENTIFIER),
  password: z.string().min(1).max(MAX_PASSWORD),
  roleHint: z.enum(['SUPER_ADMIN', 'EMPLOYEE', 'INSTITUTION', 'STAFF', 'STUDENT']).optional(),
  securityAnswer: z.string().max(MAX_IDENTIFIER).optional(),
  returnTokens: z.boolean().optional(),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD),
  newPassword: z.string().min(8).max(MAX_PASSWORD).refine(val => val !== '1234567890', {
    message: "Password cannot be the default '1234567890'",
  }),
  returnTokens: z.boolean().optional(),
}).strict();
