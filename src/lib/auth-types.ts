export type UserRole = 'SUPER_ADMIN' | 'EMPLOYEE' | 'INSTITUTION' | 'INSTITUTION_ADMIN' | 'STAFF' | 'STUDENT';

export interface JWTPayload {
  userId: number;
  role: UserRole;
  institutionId?: number;
  campusId?: number | null;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
  /** ISO timestamp of when the user account was created — used to scope notifications. */
  createdAt?: string;
}
