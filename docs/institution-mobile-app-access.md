# Institution mobile-app access

The backend implementation is accompanied by the mobile client integration in
`Taleem360-App/docs/institution-app-access.md` and
`Lms-app-parent/docs/institution-app-access.md`. No deployment or live migration
was run; the mobile integration adds no native dependencies or build artifacts.

## Management

The institution detail pages at `/sa/institutions/[id]` and
`/employee/institutions/[id]` now show a **Mobile apps → Apps** checkbox and
**Save app access** button, next to the existing website provisioning card.

Super Admin and ordinary platform Admin both have role `SUPER_ADMIN`; their
`isSuperAdmin` flag differentiates root security permissions. Both can manage
this setting, as can `EMPLOYEE`. Institution owners, institution administrators,
teachers, students and parents cannot change it. Institution administrators are
not the platform's ordinary Admin accounts.

The independent switch changes only `institutions.apps_enabled`. It never
changes website publication, admissions settings, institution approval, student
activation or web portal credentials. Changes are audited. Existing and new
institutions default to enabled to preserve current behavior; disable it when
selling a web-only package.

An institution's own flag and its main institution's flag must both permit apps.
Disabling a main institution therefore blocks its campuses too. A campus can
also be individually disabled while its main institution remains enabled.

## API and authentication

`PATCH /api/employee/institutions/{id}/apps`

```json
{"appsEnabled": false}
```

Requires an authenticated platform operator (`SUPER_ADMIN` or `EMPLOYEE`).
Cookie-authenticated updates require the same origin. The body is bounded and
strict: other fields and nonboolean values are rejected. Success returns
`{id, appsEnabled}` with `Cache-Control: no-store`; invalid input returns 400,
unauthenticated requests 401, forbidden/CSRF requests 403, missing/deleted
institutions 404. The existing RBAC mutation rate limit also applies.

The existing `POST /api/auth/login` request/response contract is retained:

- Student/Staff/Parent login requesting `returnTokens: true` is a mobile login.
- Resolve the real account and institution first, then check its app entitlement
  before issuing tokens. No username suffix alone grants access.
- Parent institution usernames and public-slug aliases resolve to the same
  authoritative institution row, so changing an alias cannot bypass the flag.
- Disabled mobile login/refresh returns HTTP 403:

  ```json
  {
    "error": "Mobile app access is disabled for your institution. You can still use the website.",
    "code": "MOBILE_APPS_DISABLED"
  }
  ```

New mobile JWTs include signed `clientType: "MOBILE"`. Refresh records persist
the same type, and rotation preserves it. Mobile password changes preserve a
mobile session type. Posting a refresh token from an older app upgrades the
legacy refresh session to mobile. Existing unmarked Bearer sessions are checked
as mobile requests too, so disabling access does not wait for old JWTs to expire.

Password-based mobile sessions have a 90-day refresh window, renewed on each
successful refresh. Existing sessions receive the longer window when refreshed;
already expired sessions still require login. Access tokens keep their existing
five-day lifetime and refresh silently. QR sessions retain their absolute 30-day
expiry. Website session lifetimes are unchanged. Plan platform labels do not
restrict login: website access is free on every plan, and the institution's
Mobile apps setting alone controls mobile product access.

Both mobile API clients retain saved tokens on network failures, rate limiting,
server errors and unreadable refresh responses. A definitive authentication
rejection or disabled mobile access still clears the session. Delayed requests
reuse a token already refreshed by another request, and rotated refresh tokens
are saved before access tokens so interrupted saves remain recoverable.

New mobile clients send their existing `accessToken` with a refresh request.
Its signature and device identity bind the operation to that device even when
the access JWT has expired. The server derives the replacement refresh token
using its signing key and the original token/proof pair; only its hash is stored.
For five minutes the identical request can recover that same replacement if it
is still active. A different proof, expired/revoked device or revoked QR session
cannot recover it. Older clients retain their existing single-use rotation.
Recovery never extends the QR session deadline or revives a logged-out session.

The apps remember successful login identifiers, with a clear-saved-details action,
and never save entered passwords. Temporary secure-storage errors show a retry
screen without deleting the session. Selected timetable, diary and notice reads
can fall back to account-scoped snapshots up to 24 hours old, with a visible
saved-time notice. Authentication failures never fall back to offline data;
logout removes that account's snapshots. Payment and attendance writes are
neither cached nor automatically retried.

Ordinary fresh session guards, including light/unread endpoints and server
actions, reject disabled mobile sessions. A mobile-marked token cannot bypass
this by being placed in a cookie. Protected requests normally return the
existing unauthorized response (401), allowing installed apps' current session
handling to clear local authentication. The stable 403 code above is available
at login/refresh for the mobile UI integration.

QR challenge generation, redemption and native QR heartbeat also enforce the
flag. A failed redemption does not consume its challenge. Web-side QR status,
history and revocation remain available for managing earlier sessions.

Web cookie login and refresh remain available when Apps is disabled. Existing
web sessions are not bulk-revoked by changing the switch. An older unmarked
cookie-only session remains classified as web; Bearer transport and native
refresh still enforce the entitlement. This is a product entitlement for the
supported app authentication protocol, not device attestation: users can still
use the intentionally available website in their phone's browser.

New phone push dispatch is also suppressed for disabled institutions/campuses,
while web inbox records continue to be created. Pushes already handed to a
provider or data previously cached on a device cannot be recalled. Blocking
existing app access takes effect on its next server request, not while offline.

## Schema and release

These changes are included in the consolidated baseline and archived migration
`0081_institution_mobile_apps.sql` (see [database migrations](../drizzle/README.md)):

- `institutions.apps_enabled boolean NOT NULL DEFAULT true`
- `refresh_tokens.client_type varchar(8) NOT NULL DEFAULT 'WEB'`

The migration is registered in the existing `scripts/migrate-production.mjs`.
Follow the normal reviewed deployment process and run the normal migrator before
starting the updated app replicas/workers. No manual SQL is needed. All backend
replicas must run the updated authentication code to enforce the restriction.
Retain the additive columns on rollback; old application code will not enforce
this new product restriction.

No mobile rebuild is needed for backend enforcement of the current clients'
existing token-based protocol. The updated mobile clients preserve `MOBILE_APPS_DISABLED` through refresh and
display it on their login forms after clearing disabled sessions. Install an
updated APK to receive that client-side feedback.

## Verification

Run from the backend directory:

```sh
npm run verify:institution-apps
node --import tsx --test scripts/verify-qr-login.ts
node --import tsx --test scripts/verify-mobile-notifications.ts
```

Results: 6 institution Apps groups, 25 QR groups and 12 notification groups passed.
Backend TypeScript and targeted lint passed. The full native/browser flow was not
tested; no production migration or deployment was performed.

The isolated PostgreSQL/WASM fixture uses the actual new migration, password
login/refresh handlers, JWT/refresh issuer, session guards, management API/RBAC,
and entitlement queries. It mocks account-status helpers, external transports,
rate limiting and audit persistence. Coverage includes all three mobile roles,
disabled/enabled behavior, existing and new web sessions, cross-institution
isolation, root/campus inheritance, unauthorized management, CSRF, validation,
legacy refresh and session-kind rotation. QR and notification fixtures exercise
the actual integration with those existing systems. No production databases,
credentials, native builds or installed devices are involved.

Source changes: schema and migration registration; `src/lib/mobile-app-access.ts`;
authentication types/issuer/session guards; login, refresh, password-change and
QR routes/services; notification dispatch; the new management API and shared
`InstitutionAppsControl`; both platform institution detail pages; regression
scripts and local verification registration.
