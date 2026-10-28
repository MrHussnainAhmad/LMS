# QR device sessions and fixed expiry

The scan challenge is still single-use and lasts at most 60 seconds. Starting
with migration 0079, redeeming it creates an account-owned mobile session lasting
exactly **30 days from login**. Refresh rotation never extends that deadline.
Existing password sessions retain their prior behavior.

## Website and device metadata

The shared QR Login dialog in Student/Staff dashboards and profiles displays the
most recent 20 QR sessions, newest first: device/model label, login date/time,
expiry, Active/Expired/Revoked status, and Revoke for active entries. Dates use
the viewer's local timezone. Refresh reloads history. Successful redemption
refreshes it automatically; closing the dialog stops history work.

Device names are bounded, sanitized display metadata supplied by the app from
expo-device manufacturer/model. They are not proof of identity or authorization.
No device identifier, QR secret, access token or refresh token is returned in
history. Unsupported/older clients display Mobile device.

Earlier QR logins cannot be reconstructed as device records: the old schema did
not distinguish those issued refresh tokens from password sessions. Log out on
the phone and scan a fresh QR to exercise managed sessions. Existing challenge
rows are not reclassified or fabricated as successful device history.

## Verified API extension

The established redeem route remains `POST /api/auth/qr-login/redeem` with
`X-QR-Login: 1`, JSON `{ qr, roleHint?, deviceName? }`. The optional deviceName is
a trimmed nonempty string of at most 120 characters. Success JSON fields remain
unchanged. Signed JWTs additionally contain qrSessionId and qrSessionExpiresAt
(integer epoch seconds); these are preserved through normal token rotation.

- `GET /api/auth/qr-login/sessions`: eligible authenticated web cookie pair;
  returns `{ sessions: [{ id, deviceName, createdAt, expiresAt, revokedAt,
  status }] }`. Last 20, owned by role/user/institution across web sessions.
- `DELETE /api/auth/qr-login/sessions/{id}`: same owner authentication, exact
  same-origin and custom-header CSRF protection, and existing QR revoke limits.
  Returns `{ id, status: "REVOKED" }`; repeatable. A foreign session returns 404,
  malformed id 400, CSRF failure 403, invalid source 401, limit 429, unavailable
  service 503. No source browser can manage a different account or tenant.
- `GET /api/auth/qr-login/session`: native Authorization bearer, no request body;
  returns `{ status: "ACTIVE", expiresAt }` or 401 for an invalid/expired/revoked
  QR session. Responses use the QR private/no-store policy. Existing API refresh
  handling remains authoritative for expired access credentials.

All normal protected access-token verification for QR JWTs checks the shared
PostgreSQL session row and existence of a current unrevoked refresh token.
Signature verification can be memoized, but revocation results cannot. Signed
proxy-header sessions also undergo the QR gate. Expiry requires no cron: database
and JWT deadlines deny access/refresh even if cleanup is delayed. Logout,
password-change revoke-all and refresh-reuse revocation invalidate QR access
through the linked refresh records. Refresh racing revocation cannot revive it.

The app checks only QR sessions every 15 seconds while foregrounded, once on
resume and on ordinary authenticated requests. Backgrounding/unmount aborts the
check and clears timers. Network failure alone does not sign out a valid user.
A fixed expiry also clears local credentials while foregrounded even offline.
A phone offline/backgrounded cannot receive an immediate UI logout: server access
is already denied; the phone clears upon its next online check/resume. No push
service, WebSocket, camera session or password-session polling is required.

## Source changes

New: drizzle/0079_qr_login_sessions.sql; src/lib/qr-session.ts;
src/components/auth/QrLoginSessions.tsx; the sessions, sessions/[id], and session
routes under src/app/api/auth/qr-login/. Extended: schema.ts, auth-types.ts,
auth-edge.ts, auth.ts, qr-login.ts, existing redeem/refresh routes,
QrLoginButton.tsx, migrate-production.mjs and verify-qr-login.ts.

Mobile changes: utils/qr-login.ts (lazy device metadata), utils/auth-policy.ts
(signed-session metadata), hooks/use-qr-session-watch.ts, AuthContext.tsx,
QrLoginScanner.tsx and regression fixtures. The request timer covers the network
exchange, not post-response secure storage; branding remains nonblocking. Camera
activation, focus/background cleanup, duplicate suppression and the eight-second
network deadline remain in place. No new dependency was added.

## Local validation and rollout

Observed: 24 backend groups passed against dedicated local PostgreSQL with an
8-connection pool, including history scope, CSRF, cached access rejection,
rotation expiry, logout, expiry without cron, and refresh/revoke races. The prior
23-group suite also passed against PostgreSQL WASM before the final race case.
17 mobile groups and 8 access groups passed, with simulated camera/storage and
transport. Device testing is still required for the final phone UI.

Migration 0079 was applied only to the localhost app database, through the normal
migrator after explicitly checking the host is loopback. No production migration,
deployment, native build or live credential change was performed. Production
rollout must apply 0079 (and any earlier pending migrations) before starting code
that reads qr_session_id. Use the existing reviewed migrator/app/worker release
process, as documented in deployment/README.md.

For rollback, keep the new tables/column and history. Do not downgrade to auth
code that ignores qrSessionId: it could accept a previously revoked signed JWT.
Retain the QR revocation gate until all issued QR access tokens expire (at most
the existing five-day access lifetime), or use a separately reviewed session
invalidation plan. This extension does not require deleting historical backups,
resetting passwords or changing the application's JWT secret.

Final checks also passed: backend/mobile TypeScript, targeted ESLint, Android
JavaScript export (no native build), and whitespace checks. Local HTTP smoke
checks returned 200 with ready database/cache, 401 for unauthenticated session
history and 401 for an unauthenticated QR-session heartbeat. These are transport
and authorization checks, not a claim of physical-device UI verification.


History cleanup regression: each panel mount has a distinct active scope.
Cleanup invalidates that scope and detaches listeners without aborting fetch;
requests retain their independent eight-second deadline. No cancellation marker
is thrown on close or Strict Mode replay. History refreshes retain the scope,
and stale results cannot write into a later mount. The actual website component
is tested in Taleem360-App/scripts/verify-qr-login.mjs: Strict Mode replay,
refresh-key changes, out-of-order responses, late old-mount responses and close
during revocation pass. The suite passes 19 groups. Targeted component/test lint
passes; physical browser behavior is still checked by reloading the website.


The website automatically renews an expired challenge while the dialog is open
and visible. It first checks the old status so a completed login is not replaced.
A per-generation request guard prevents duplicate creation. Hidden tabs pause
renewal and check/renew on return. Closing or consuming the challenge removes the
timers. Request/authentication failures stop automatic work and leave manual
New QR available; no blind retry loop is used. Two actual-dialog fixture groups
cover expiry, last-second consumption, duplicate suppression, visibility and
close cleanup. The shared fixture suite now passes 21 groups.
