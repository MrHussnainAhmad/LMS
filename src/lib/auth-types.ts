export type UserRole = 'SUPER_ADMIN' | 'EMPLOYEE' | 'INSTITUTION' | 'INSTITUTION_ADMIN' | 'STAFF' | 'STUDENT' | 'PARENT';

export function requiresPasswordChange(_role: string, mustChangePassword?: boolean): boolean {
  return Boolean(mustChangePassword);
}

export interface JWTPayload {
  planDeviceSessionId?: string;
  clientType?: "WEB" | "MOBILE";
  qrSessionId?: string;
  qrSessionExpiresAt?: number;
  userId: number;
  role: UserRole;
  institutionId?: number;
  campusId?: number | null;
  /** Authenticated campus remains fixed while institutionId selects a view. */
  homeInstitutionId?: number;
  rootInstitutionId?: number;
  campusReadOnly?: boolean;
  campusName?: string;
  homeCampusName?: string;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
  studentAcademicStatus?: 'ACTIVE' | 'GRADUATED';
  graduatedStudentAccessAllowed?: boolean;
  /** ISO timestamp of when the user account was created — used to scope notifications. */
  createdAt?: string;
}
