import { randomBytes } from 'node:crypto';
/** Unique 144-bit credentials, delivered once through an authorized response. */
export function temporaryPassword() { return randomBytes(18).toString('base64url'); }
