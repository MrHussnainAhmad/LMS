export type UserRole = 'SUPER_ADMIN' | 'EMPLOYEE' | 'INSTITUTION' | 'STAFF' | 'STUDENT';

export interface JWTPayload {
  userId: number;
  role: UserRole;
  institutionId?: number;
  campusId?: number | null;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
}
