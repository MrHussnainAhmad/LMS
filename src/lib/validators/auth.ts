import { z } from 'zod';

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
  securityAnswer: z.string().optional(),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).refine(val => val !== '1234567890', {
    message: "Password cannot be the default '1234567890'",
  }),
}).strict();
