> The newer [QR session extension](qr-session-management.md) adds managed device
> history, fixed 30-day expiry and server-enforced revocation. Its rollout and
> rollback notes supersede the original session-lifetime notes below.

# QR account login implementation and verification

## Scope and architecture

Backend authentication and the authenticated LMS website are implemented first.
The Taleem360 scanner now consumes the finalized [API contract](qr-account-login-api.md).
Its source files, test results and phone acceptance checklist are documented in
`Taleem360-App/docs/qr-login.md` in the sibling mobile repository.
No deployment, production build, live migration, or production data access was
performed for this feature.

The existing authentication architecture uses `/api/auth/login`,
`/api/auth/refresh`, `/api/auth/logout`, signed access JWTs, and PostgreSQL-backed
hashed refresh tokens. Student and Staff accounts already initialize through
the same mobile `AuthContext.login` method. There is no separate QR session
issuer. `createTokens` accepts an optional insert store so QR consumption and
normal refresh-token insertion can participate in one transaction; existing
callers retain exactly their default behavior.

Students and Staff have dashboards and profile/account pages, not separate
settings routes. Both locations use one `QrLoginButton` client component that
receives no user/tenant identity props. The server derives ownership exclusively
from the web cookie pair. The graduated Student dashboard also includes it,
subject to the existing graduate-access policy enforced by the backend.

Active, non-deleted `STAFF` accounts are explicitly eligible. Other system roles
are excluded even if an existing credential-login lookup can find an institution
administrator while looking up a staff identifier. No new role, authentication
scheme, dependency, environment secret, or per-staff opt-in setting was added.

## Security decisions

- Random 256-bit single-use secret plus UUID; only its SHA-256 hash is stored.
  QR data contains no personal data, passwords, or reusable tokens.
- Lifetime 60 seconds maximum, capped by the source access/refresh expiry.
  QR timestamps use `timestamptz` to avoid session-timezone ambiguity.
- The source refresh row is the revocable web-session security context. Logout,
  refresh rotation, expiry, password-change revoke-all, and account changes
  invalidate pending QRs. Re-login in a different browser session does not grant
  ownership of a previously issued QR.
- All operations lock the source refresh row before challenge mutation. Row
  locks and a conditional consumption update serialize races across replicas;
  shared account/tenant rows remain locked while credentials are issued.
- Account, tenant/root, lockout and graduate policy are rechecked from the DB.
  A fingerprint additionally invalidates codes after a password, creation
  identity, or Staff campus change. Client-selected institutions are rejected.
- Optional `roleHint` constrains mobile Student/Staff entry points before
  consumption/issuance. The database account is still authoritative.
- Creation and cancellation require exact same-origin requests and a custom
  header. Browser-origin redemption is rejected; mobile redemption does not
  set browser auth cookies. Pre-existing native cookies cannot select identity.
- Shared Redis rate limiting fails closed, including on expiry-command failure.
  Account limits span IPs, and redemption limits use the existing trusted-IP
  helper. Existing password-login limiting is unchanged.
- Responses use no-store/private and no-referrer. QR rendering happens in
  process; no third-party service sees the bearer code. The existing global
  X-Frame-Options policy remains in place.
- Successful QR logins are audited without QR content or issued credentials.
  Unexpected errors are logged without SQL parameters or exception payloads.
- Closing/unmounting attempts cancellation. If the connection fails, server
  expiry remains authoritative. Closing cannot revoke an already completed
  mobile login. The dialog communicates the bearer-code risk.
- Hourly existing token maintenance removes up to 5,000 challenges expired over
  one day ago. Expiry and replay protection do not depend on cleanup.

These choices follow the principles described in OWASP's
[Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
and [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
They do not constitute an external security certification.

## Source files for this feature

New files:

- `drizzle/0078_qr_account_login.sql`
- `src/lib/qr-login.ts`
- `src/lib/qr-login-http.ts`
- `src/app/api/auth/qr-login/route.ts`
- `src/app/api/auth/qr-login/[id]/route.ts`
- `src/app/api/auth/qr-login/redeem/route.ts`
- `src/components/auth/QrLoginButton.tsx`
- `scripts/verify-qr-login.ts`
- `docs/qr-account-login-api.md`
- `docs/qr-account-login-implementation.md`

Existing files extended:

- `src/db/schema.ts`
- `src/lib/auth.ts`
- `src/lib/rate-limit.ts`
- `src/lib/token-maintenance.ts`
- `src/app/(student)/student/dashboard/page.tsx`
- `src/app/(staff)/staff/dashboard/page.tsx`
- `src/app/(student)/student/profile/StudentProfileClient.tsx`
- `src/app/(staff)/staff/profile/StaffProfileClient.tsx`
- `scripts/migrate-production.mjs`
- `scripts/verify-local.mjs`
- `package.json`
- `.github/workflows/verify.yml`
- `.gitignore` (explicitly includes the new QR regression suite)

The working tree contained unrelated pre-existing work. This list describes QR
login changes, not every modified file in the checkout.

## Verification

Run the isolated regression suite without a server or `.env`:

```sh
npm run verify:qr-login
```

It executes the real route handlers, Drizzle queries, JWT issuer, refresh and
logout handlers against a disposable PostgreSQL WASM fixture. Redis command
responses, request context and nonessential side effects are simulated. The
password-route tests perform real Argon2 verification. The suite covers:

- Migration creation/reapplication, expected fields and indexes.
- Student/Staff creation and redemption, response/JWT compatibility and hashes.
- Unsupported roles, malformed credentials, mismatched web cookie identities.
- Student/Staff role hints, without consuming or issuing on mismatch.
- Refresh, revocation, expiry, clock/timezone behavior and replay rejection.
- Tenant, account, exact source-session ownership and payload scope isolation.
- Inactive/deleted accounts, institutions/root, graduates and lockouts.
- Password changes and institution transfers after challenge issuance.
- Competing scans, and cancellation racing redemption.
- Token insertion failure rollback and retry.
- Existing refresh rotation/logout and web expiry/rotation/revoke-all.
- Malformed input, wrong secrets, ID-card confusion, JSON/body limits and CSRF.
- Native cookie isolation, shared limiter rejection/outage behavior.
- Unchanged Student/Staff credential login with real password verification.
- Bounded cleanup and audit redaction.

The default WASM fixture has one serialized SQL connection. Its competing-call
tests establish single-use outcomes but do **not** establish real connection or
multi-replica scheduling behavior. The same suite supports an eight-connection
PostgreSQL pool when `QR_LOGIN_TEST_DATABASE_URL` points to an explicitly
dedicated **loopback** database whose name ends in `qr_login_test`. It creates
a random isolated schema and removes it afterward. Never pass production URLs.
The GitHub verification workflow provisions this disposable database and runs
the suite separately after local fixture tests. That CI execution was configured,
not executed from this workspace.

Locally observed results are recorded below; they must not be confused with a
native-device or production verification:

- QR authentication regression suite: passed, 20 groups.
- Existing role-boundary suite: passed, 55 permission cases, 46 direct API cases,
  16 integration groups.
- Tenant scope audit: passed.
- Targeted ESLint: passed. Full TypeScript check (`tsc --noEmit --incremental false`): passed.
- Existing `verify-first-login.ts`: failed. Its setup points the database at
  `127.0.0.1:1`; a fresh RBAC account check reaches that deliberately unavailable
  connection and returns 500. This is not a successful compatibility check.
  The new suite independently verifies actual Student/Staff password routes.
- Local Docker PostgreSQL run: unavailable; no Docker engine pipe is available.
- Browser interaction/viewport checks, physical mobile scans, real multiple-app
  replica races, and live Redis outage tests: not performed locally. No simulator,
  emulator, ADB, APK, AAB, iOS, EAS, deployment or production build was run.

## Deployment and rollback guidance (not executed)

1. Review the feature diff separately from other uncommitted work. Preserve a
   normal database backup before deployment.
2. Apply the forward-only `0078_qr_account_login.sql` through the existing
   production migrator (`npm run db:migrate:production`) in the controlled
   deployment process, before starting application/worker code that uses it.
   It is registered in the supplemental migration list; no manual SQL is needed.
   This command is documentation, not authorization to run it against production.
3. Roll out application replicas and the token-maintenance worker consistently.
   Keep PostgreSQL, Redis, JWT configuration, proxy Host/protocol handling and
   trusted-IP sanitization consistent across replicas. No new secret is required.
4. Release the mobile scanner against the documented contract. This backend
   change does not update the deployed server or an installed phone binary.
5. Verify a Student and Staff test account, source-session logout, cancellation,
   repeat scanning and a normal password login after deployment.

For rollback, restore the previous application and worker version together.
Retain the new table and migration ledger: old code ignores them, ordinary
password authentication remains compatible, and existing refresh records are
not rewritten. Do not drop authentication tables, revoke every user, or roll
back the database to undo this additive feature. Pending QRs expire within a
minute; mobile sessions already issued remain normal existing sessions.

## Remaining limits

A copied, valid QR can be redeemed by its holder; user privacy and phishing
awareness remain necessary. A stolen authenticated web session can generate
codes until its existing security context is revoked. Existing access-token
lifetimes/revocation semantics are inherited, not changed by this feature.
Response loss after a committed redemption requires a new code; the consumed
secret cannot retrieve issued credentials. Rate limiting intentionally makes
QR login unavailable during a shared Redis outage while keeping password login
on its existing behavior. Large sites may need to tune shared-IP limits for
their NAT population after measuring legitimate usage.

## QR release commands and acceptance handoff

These commands are instructions for the operator, not actions executed here.
Use the existing reviewed release process to supply matching immutable app,
worker and migrator image digests containing this feature. Do not merely restart
old images: migration 0078 and the new route code must both be present. Review
other pending migrations in the release before proceeding; the normal migrator
applies every pending registered migration, not just QR login.

From the repository directory on the server, with the existing private `.env`
and reviewed `deployment/release.env` already present:

```sh
docker compose --env-file .env --env-file deployment/release.env \
  -f docker-compose.yml -f deployment/compose.release.yml pull

docker compose --env-file .env --env-file deployment/release.env \
  -f docker-compose.yml -f deployment/compose.release.yml run --rm migrate

docker compose --env-file .env --env-file deployment/release.env \
  -f docker-compose.yml -f deployment/compose.release.yml up -d --wait \
  app app2 push-receipt-worker institution-restore-worker payment-reconciliation-worker
```

Create and validate the normal private pre-release database backup before the
migration, as described in `deployment/README.md`. Stop on a failed migration;
do not run ad hoc SQL or start newer application code over an old schema. Keep
the same Compose files, release environment and project identity used by the
existing deployment. The commands above assume the release-image configuration;
a source-build deployment must follow its existing image preparation process.
No new QR environment secret or mobile API hostname is required.

After rollout, verify readiness using the existing readiness check. With a test
Student and an active test Staff account, open QR Login in the website dashboard
and profile, then scan from the matching mobile login mode. Verify source web
logout, expiry, cancellation, duplicate scans, password-change navigation,
restart/session restoration and ordinary password login. The complete phone
checklist is in `Taleem360-App/docs/qr-login.md`. Never paste active QR contents,
tokens or private environment values into diagnostic reports.

Rollback uses the previous reviewed app/worker image digests and the same
`up -d --wait` service command. Keep the additive QR table and migration ledger.
Review compatibility with any unrelated migrations included in the same release
before rolling images back; this QR feature alone does not justify restoring
an older database or deleting issued sessions.

Final local checks on 2026-10-28 reran the backend QR suite (20 groups), mobile
QR suite (15), access suite (8), attendance suite (5), notification suite (4),
and mobile TypeScript/targeted ESLint successfully. Android JavaScript export
completed successfully. Docker remains unavailable (no engine pipe); neither
an actual multi-connection PostgreSQL run nor physical-device testing is claimed.