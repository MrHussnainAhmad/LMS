import { randomBytes } from 'node:crypto';

/** New student, staff, and parent accounts must set mustChangePassword: true. */
export const INITIAL_PORTAL_PASSWORD = '1234567890';

/** Unique 144-bit credentials, delivered once through an authorized response. */
export function temporaryPassword() { return randomBytes(18).toString('base64url'); }
