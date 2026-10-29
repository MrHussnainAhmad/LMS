import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { accountLockouts, institutions, qrLoginChallenges, qrLoginSessions, refreshTokens } from '@/db/schema';
import { createTokens, verifyAccessToken } from '@/lib/auth';
import { requiresPasswordChange, type JWTPayload } from '@/lib/auth-types';
import { mobileAppAccessAllowed, MOBILE_APPS_DISABLED } from './mobile-app-access';

export const QR_LOGIN_TTL_SECONDS = 60;
export const QR_LOGIN_PREFIX = 'nisaab360:qr-login:v1:';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const QR_PATTERN = new RegExp(`^${QR_LOGIN_PREFIX}(${UUID}):([A-Za-z0-9_-]{43})$`);
export const QR_LOGIN_ID_PATTERN = new RegExp(`^${UUID}$`);
type Store = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;
export type QrOwner = { payload: JWTPayload; sourceHash: string; accessExpiresAt: number };
type Challenge = typeof qrLoginChallenges.$inferSelect;

export class QrLoginError extends Error {
  constructor(message: string, public readonly status = 401) { super(message); }
}
const invalid = () => new QrLoginError('QR login is invalid or no longer available. Generate a new code.');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function parseQrLogin(value: unknown) {
  if (typeof value !== 'string' || value.length > 160) return null;
  const match = QR_PATTERN.exec(value);
  if (!match || Buffer.from(match[2], 'base64url').toString('base64url') !== match[2]) return null;
  return { id: match[1], secretHash: hash(match[2]) };
}

/** Owner operations require the actual web cookie pair, never a bearer/header identity. */
export async function readQrOwner(accessToken?: string, refreshToken?: string): Promise<QrOwner> {
  if (!accessToken || !refreshToken || !/^[a-f0-9]{80}$/i.test(refreshToken)) throw new QrLoginError('Sign in again to use QR login.');
  const payload = await verifyAccessToken(accessToken);
  const exp = (payload as (JWTPayload & { exp?: number }) | null)?.exp;
  if (!payload || typeof exp !== 'number' || exp * 1000 <= Date.now()) throw new QrLoginError('Sign in again to use QR login.');
  if (!['STUDENT', 'STAFF'].includes(payload.role) || !payload.institutionId) throw new QrLoginError('QR login is only available to Students and Staff.', 403);
  return { payload, sourceHash: hash(refreshToken), accessExpiresAt: exp * 1000 };
}

/** Check the account and tenant from authoritative rows, not cached JWT claims. */
async function eligibleAccount(store: Store, role: string, userId: number, institutionId: number) {
  if (!['STUDENT', 'STAFF'].includes(role) || !Number.isSafeInteger(userId) || !Number.isSafeInteger(institutionId)) throw invalid();
  const table = sql.identifier(role === 'STUDENT' ? 'students' : 'staff');
  const result = await store.execute(sql`
    SELECT u.id, u.institution_id AS "institutionId", u.created_at AS "createdAt",
      u.password_hash AS "passwordHash", u.must_change_password AS "mustChangePassword",
      ${role === 'STAFF' ? sql`u.campus_id` : sql`NULL::integer`} AS "campusId",
      ${role === 'STUDENT' ? sql`u.academic_status::text` : sql`NULL::text`} AS "academicStatus",
      i.allow_graduated_student_access AS "graduatedAccessAllowed", i.parent_institution_id AS "parentId"
    FROM ${table} u JOIN institutions i ON i.id=u.institution_id
    WHERE u.id=${userId} AND u.institution_id=${institutionId} AND u.is_active=true AND u.deleted_at IS NULL
      AND i.status='APPROVED' AND i.deleted_at IS NULL
    FOR SHARE OF u, i
  `);
  const row = result.rows[0] as undefined | {
    id: number; institutionId: number; createdAt: Date | string; passwordHash: string;
    mustChangePassword: boolean; campusId: number | null; academicStatus: 'ACTIVE' | 'GRADUATED' | null;
    graduatedAccessAllowed: boolean; parentId: number | null;
  };
  if (!row || (role === 'STUDENT' && row.academicStatus === 'GRADUATED' && !row.graduatedAccessAllowed)) throw invalid();
  if (row.parentId !== null) {
    const [root] = await store.select({ id: institutions.id }).from(institutions).where(and(
      eq(institutions.id, row.parentId), eq(institutions.status, 'APPROVED'), isNull(institutions.deletedAt), isNull(institutions.parentInstitutionId),
    )).for('share').limit(1);
    if (!root) throw invalid();
  }
  const [lockout] = await store.select({ lockedUntil: accountLockouts.lockedUntil }).from(accountLockouts)
    .where(and(eq(accountLockouts.userRole, role as 'STUDENT' | 'STAFF'), eq(accountLockouts.userId, userId))).for('share').limit(1);
  if (lockout?.lockedUntil && lockout.lockedUntil.getTime() > Date.now()) throw invalid();
  const createdAt = new Date(row.createdAt).toISOString();
  const payload: JWTPayload = {
    userId, role: role as 'STUDENT' | 'STAFF', institutionId, campusId: row.campusId ?? undefined,
    mustChangePassword: requiresPasswordChange(role, row.mustChangePassword), createdAt,
    ...(role === 'STUDENT' ? { studentAcademicStatus: row.academicStatus!, graduatedStudentAccessAllowed: row.graduatedAccessAllowed } : {}),
  };
  return { payload, fingerprint: hash(JSON.stringify([createdAt, row.passwordHash, row.campusId])) };
}

async function ownerSource(store: Store, owner: QrOwner) {
  const [source] = await store.select().from(refreshTokens).where(and(
    eq(refreshTokens.tokenHash, owner.sourceHash), eq(refreshTokens.userId, owner.payload.userId),
    eq(refreshTokens.userRole, owner.payload.role), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date()),
  )).for('update').limit(1);
  if (!source || owner.accessExpiresAt <= Date.now()) throw new QrLoginError('Web session expired. Sign in again.');
  return source;
}

export async function createQrLogin(owner: QrOwner) {
  return db.transaction(async tx => {
    const source = await ownerSource(tx, owner);
    const account = await eligibleAccount(tx, owner.payload.role, owner.payload.userId, owner.payload.institutionId!);
    if (!await mobileAppAccessAllowed(account.payload, true, tx)) throw new QrLoginError(MOBILE_APPS_DISABLED.error, 403);
    const secret = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const expiresAt = new Date(Math.min(Date.now() + QR_LOGIN_TTL_SECONDS * 1000, owner.accessExpiresAt, source.expiresAt.getTime()));
    // Refresh invalidates every older pending code from this exact web session.
    await tx.update(qrLoginChallenges).set({ revokedAt: new Date() }).where(and(
      eq(qrLoginChallenges.sourceRefreshTokenId, source.id), isNull(qrLoginChallenges.consumedAt), isNull(qrLoginChallenges.revokedAt),
      gt(qrLoginChallenges.expiresAt, sql`clock_timestamp()`),
    ));
    await tx.insert(qrLoginChallenges).values({ id, secretHash: hash(secret), userRole: account.payload.role,
      userId: account.payload.userId, institutionId: account.payload.institutionId!, sourceRefreshTokenId: source.id,
      accountFingerprint: account.fingerprint, expiresAt });
    return { challengeId: id, qr: `${QR_LOGIN_PREFIX}${id}:${secret}`, expiresAt: expiresAt.toISOString(), status: 'PENDING' as const };
  });
}

function challengeStatus(row: Challenge) {
  return row.consumedAt ? 'CONSUMED' : row.revokedAt ? 'REVOKED' : row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : 'PENDING';
}

export async function inspectQrLogin(owner: QrOwner, id: string, revoke = false) {
  return db.transaction(async tx => {
    const source = await ownerSource(tx, owner);
    const account = await eligibleAccount(tx, owner.payload.role, owner.payload.userId, owner.payload.institutionId!);
    const [row] = await tx.select().from(qrLoginChallenges).where(and(eq(qrLoginChallenges.id, id),
      eq(qrLoginChallenges.sourceRefreshTokenId, source.id), eq(qrLoginChallenges.userId, owner.payload.userId),
      eq(qrLoginChallenges.userRole, owner.payload.role), eq(qrLoginChallenges.institutionId, owner.payload.institutionId!),
    )).for('update').limit(1);
    if (!row) throw new QrLoginError('QR login challenge not found.', 404);
    if (account.fingerprint !== row.accountFingerprint) throw invalid();
    if (revoke && challengeStatus(row) === 'PENDING') {
      await tx.update(qrLoginChallenges).set({ revokedAt: new Date() }).where(eq(qrLoginChallenges.id, id));
      row.revokedAt = new Date();
    }
    return { challengeId: row.id, status: challengeStatus(row), expiresAt: row.expiresAt.toISOString() };
  });
}

export async function redeemQrLogin(qr: unknown, roleHint?: 'STUDENT' | 'STAFF', deviceName = 'Mobile device') {
  const parsed = parseQrLogin(qr);
  if (!parsed) throw new QrLoginError('Invalid QR login code.', 400);
  return db.transaction(async tx => {
    const [candidate] = await tx.select().from(qrLoginChallenges).where(eq(qrLoginChallenges.id, parsed.id)).limit(1);
    if (!candidate || !timingSafeEqual(Buffer.from(candidate.secretHash, 'hex'), Buffer.from(parsed.secretHash, 'hex'))) throw invalid();
    // All operations lock the source first, then the challenge. Logout/rotation
    // uses the same refresh row, so two replicas cannot redeem or revoke past it.
    const [source] = await tx.select().from(refreshTokens).where(and(eq(refreshTokens.id, candidate.sourceRefreshTokenId),
      eq(refreshTokens.userId, candidate.userId), eq(refreshTokens.userRole, candidate.userRole),
      isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date()),
    )).for('update').limit(1);
    if (!source) throw invalid();
    const [row] = await tx.select().from(qrLoginChallenges).where(and(eq(qrLoginChallenges.id, parsed.id),
      isNull(qrLoginChallenges.consumedAt), isNull(qrLoginChallenges.revokedAt), gt(qrLoginChallenges.expiresAt, sql`clock_timestamp()`),
    )).for('update').limit(1);
    if (!row) throw invalid();
    const account = await eligibleAccount(tx, row.userRole, row.userId, row.institutionId);
    if (!await mobileAppAccessAllowed(account.payload, true, tx)) throw new QrLoginError(MOBILE_APPS_DISABLED.error, 403);
    if (account.fingerprint !== row.accountFingerprint) throw invalid();
    if (roleHint && account.payload.role !== roleHint) throw new QrLoginError('QR code does not match the selected sign-in type.', 403);
    // The existing issuer writes into this transaction. A failure, including a
    // final expiry check, rolls back both consumption AND the mobile session.
    const sessionId = randomUUID();
    const sessionExpiresAt = Math.floor(Date.now() / 1000) + 30 * 86400;
    await tx.insert(qrLoginSessions).values({ id: sessionId, userRole: account.payload.role,
      userId: account.payload.userId, institutionId: account.payload.institutionId!,
      deviceName: deviceName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || 'Mobile device',
      expiresAt: new Date(sessionExpiresAt * 1000) });
    account.payload.clientType = "MOBILE";
    account.payload.qrSessionId = sessionId;
    account.payload.qrSessionExpiresAt = sessionExpiresAt;
    const tokens = await createTokens(account.payload, tx);
    const consumed = await tx.update(qrLoginChallenges).set({ consumedAt: new Date() }).where(and(
      eq(qrLoginChallenges.id, row.id), isNull(qrLoginChallenges.consumedAt), isNull(qrLoginChallenges.revokedAt),
      gt(qrLoginChallenges.expiresAt, sql`clock_timestamp()`),
    )).returning({ id: qrLoginChallenges.id });
    if (!consumed.length) throw invalid();
    return { ...tokens, payload: account.payload };
  });
}

/** Hourly maintenance; retain terminal/expired status for one day, in bounded batches. */
export async function pruneExpiredQrLoginChallenges() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(qrLoginChallenges).where(sql`${qrLoginChallenges.id} IN (
    SELECT ${qrLoginChallenges.id} FROM ${qrLoginChallenges} WHERE ${lt(qrLoginChallenges.expiresAt, cutoff)} LIMIT 5000
  )`);
}


/** Account-wide history, including sessions created from other web browsers. */
export async function listQrLoginSessions(owner: QrOwner) {
  return db.transaction(async tx => {
    await ownerSource(tx, owner);
    await eligibleAccount(tx, owner.payload.role, owner.payload.userId, owner.payload.institutionId!);
    const rows = await tx.select({ id: qrLoginSessions.id, deviceName: qrLoginSessions.deviceName,
      createdAt: qrLoginSessions.createdAt, expiresAt: qrLoginSessions.expiresAt, revokedAt: qrLoginSessions.revokedAt,
      active: sql<boolean>`EXISTS (SELECT 1 FROM refresh_tokens rt WHERE rt.qr_session_id=qr_login_sessions.id
        AND rt.revoked_at IS NULL AND rt.expires_at>clock_timestamp())`,
    }).from(qrLoginSessions).where(and(eq(qrLoginSessions.userRole, owner.payload.role),
      eq(qrLoginSessions.userId, owner.payload.userId), eq(qrLoginSessions.institutionId, owner.payload.institutionId!),
    )).orderBy(desc(qrLoginSessions.createdAt), desc(qrLoginSessions.id)).limit(20);
    return rows.map(row => ({ id: row.id, deviceName: row.deviceName, createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null,
      status: row.revokedAt ? 'REVOKED' : row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : !row.active ? 'REVOKED' : 'ACTIVE' }));
  });
}

export async function revokeQrLoginSession(owner: QrOwner, id: string) {
  if (!QR_LOGIN_ID_PATTERN.test(id)) throw new QrLoginError('Invalid session identifier.', 400);
  return db.transaction(async tx => {
    await ownerSource(tx, owner);
    await eligibleAccount(tx, owner.payload.role, owner.payload.userId, owner.payload.institutionId!);
    const [row] = await tx.select().from(qrLoginSessions).where(and(eq(qrLoginSessions.id, id),
      eq(qrLoginSessions.userRole, owner.payload.role), eq(qrLoginSessions.userId, owner.payload.userId),
      eq(qrLoginSessions.institutionId, owner.payload.institutionId!),
    )).for('update').limit(1);
    if (!row) throw new QrLoginError('QR session not found.', 404);
    if (!row.revokedAt) await tx.update(qrLoginSessions).set({ revokedAt: new Date() }).where(eq(qrLoginSessions.id, id));
    await tx.execute(sql`UPDATE plan_device_sessions SET revoked_at=now() WHERE refresh_token_hash IN
      (SELECT token_hash FROM refresh_tokens WHERE qr_session_id=${id}) AND revoked_at IS NULL`);
    return { id, status: 'REVOKED' };
  });
}
