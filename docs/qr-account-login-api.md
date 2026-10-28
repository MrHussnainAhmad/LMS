> QR device-session extension: see [session management](qr-session-management.md).
> It adds history/revocation routes and optional deviceName without changing the
> login response. Newly issued QR mobile sessions have a fixed 30-day deadline.

# QR account login API contract

Implemented in `src/app/api/auth/qr-login/`. This is account authentication, not
student ID-card verification or attendance. The contract below is derived from
the implemented routes and the current Taleem360 authentication code.

## Existing authentication that this feature extends

- `POST /api/auth/login`: accepts credentials, `roleHint`, and `returnTokens`.
  With `returnTokens: true`, success contains `message`, `role`,
  `mustChangePassword`, `accessToken`, and `refreshToken`.
- `POST /api/auth/refresh`: native clients post `{ "refreshToken": "..." }` and
  receive the rotated access/refresh pair. Existing reuse detection applies.
- `POST /api/auth/logout`: accepts the native refresh token and revokes it.
- `src/lib/auth.ts`: `createTokens` issues the same HS256 JWTs and hashed,
  database-backed refresh tokens for password and QR login. QR redemption supplies
  its transaction to this existing function; password login retains its default.
- Taleem360 uses `src/utils/api.ts`, SecureStore through `auth-storage.ts`,
  `AuthContext.login`, `readAppSession`, and protected Expo Router navigation.
  QR authentication must use those same mechanisms.

## Eligibility and tenant rules

Only `STUDENT` and `STAFF` are supported. Eligible Staff means an active,
non-deleted row in `staff`, the same account class supported by Taleem360.
An institution custom role does not turn an administrator or platform employee
into a Staff account. There is no new per-staff opt-in setting.

Creation and redemption freshly check the account, institution ownership,
institution approval/deletion, parent-institution approval where applicable,
graduate access policy, and active login lockouts. Parents, applicants,
institution administrators, institution accounts, employees and super admins
cannot create or redeem their own QR-login challenges.

No client-supplied user or institution ID selects the account. The stored
challenge determines identity and tenant; account transfers invalidate it.
Routes use the configured backend host. Do not derive an API host from a QR.

## Create a challenge (authenticated website)

`POST /api/auth/qr-login`

- Requires the real `access_token` and `refresh_token` web cookies for the same
  eligible account. Bearer authentication is intentionally rejected here.
- Requires `X-QR-Login: 1` and an `Origin` exactly matching the request host,
  protocol and port. Sibling subdomains are not considered the same origin.
  Fetch Metadata, when supplied, must also be same-origin or `none`.
- No request body is needed; account identity never comes from a body.
- The browser uses a relative URL. Deployment must preserve Host and provide
  the trusted `X-Forwarded-Proto` when terminating HTTPS at the reverse proxy.

Success: **201**

```json
{
  "challengeId": "<uuid-v4>",
  "qr": "nisaab360:qr-login:v1:<uuid-v4>:<43-character-base64url-secret>",
  "qrImageDataUrl": "data:image/png;base64,<image>",
  "status": "PENDING",
  "expiresAt": "<ISO-8601 timestamp>",
  "serverTime": "<ISO-8601 timestamp>"
}
```

Default lifetime is 60 seconds, shortened if the originating access or refresh
session expires sooner. Clocks on application and database hosts must be
synchronized. Creating a replacement revokes older pending codes from the same
web refresh session, across tabs and application replicas. Other devices'
web sessions remain separate.

`qr` is a temporary bearer capability: do not copy it to logs, analytics,
crash reports, persistent browser storage, third-party QR renderers, or URLs.
The PNG is generated in process. Anyone holding an unexpired QR can attempt
to sign in; the website explicitly warns the user.

## Read status (authenticated website)

`GET /api/auth/qr-login/{challengeId}`

Requires the same eligible account **and originating refresh session** as
creation. A different account, tenant or web session gets no ownership access.
The identifier alone cannot authenticate anyone.

Success: **200**

```json
{
  "challengeId": "<uuid-v4>",
  "status": "PENDING",
  "expiresAt": "<ISO-8601 timestamp>",
  "serverTime": "<ISO-8601 timestamp>"
}
```

Statuses: `PENDING`, `CONSUMED`, `EXPIRED`, `REVOKED`. No secret or mobile session
credentials are returned by status. Expiration is computed even before cleanup.
If the source session becomes unavailable, the owner request returns 401 rather
than granting access to historical status. Poll only while the dialog is open
and pending; the shared component polls every three seconds, skips hidden tabs,
and stops after expiry, completion, closure, or a connection error.

## Revoke (authenticated website)

`DELETE /api/auth/qr-login/{challengeId}`

Same owner/session requirements as status, plus the same-origin and custom
header protections used by creation. Success is **200**, with the status shape
above. Revoking a pending code changes it to `REVOKED`; repeating cancellation
returns its terminal status. A completed login cannot be undone by cancelling
its QR: use the existing session-revocation mechanisms instead.

Close/unmount sends a best-effort keepalive cancellation. If the network is
unavailable, expiry remains authoritative. A scan racing cancellation has one
winner; closing cannot retract credentials already issued by a completed scan.

## Redeem (native mobile application)

`POST /api/auth/qr-login/redeem`

Headers:

```text
Content-Type: application/json
X-QR-Login: 1
```

JSON:

```json
{
  "qr": "nisaab360:qr-login:v1:<uuid-v4>:<43-character-base64url-secret>",
  "roleHint": "STUDENT"
}
```

`roleHint` is optional at the API level, but the mobile Student/Staff entry point
must send its selected type (`STUDENT` or `STAFF`). It constrains the exchange;
it never supplies authoritative identity. A mismatched hint returns **403**
without consuming the code or creating a session. Unknown fields are rejected,
including user IDs, institution IDs and administrator roles.

No existing bearer credentials are needed. Do not attach Authorization or
browser Origin/Fetch Metadata headers: those requests are rejected with 403.
Native cookie jars are ignored when determining the QR account, and redemption
never writes web authentication cookies. Prefer `credentials: "omit"`.
The API must be called through the configured mobile backend base URL.

Success: **200**, matching credential login with `returnTokens: true`:

```json
{
  "message": "Logged in successfully",
  "role": "STUDENT",
  "mustChangePassword": false,
  "accessToken": "<existing-format-access-JWT>",
  "refreshToken": "<existing-format-refresh-token>"
}
```

Identity, institution, campus, creation time and relevant academic claims follow
the existing JWT contract. There is no separate QR token/session system. The
current Student/Staff password-change policy is preserved.

### Mobile flow

1. Open the scanner from the selected Student or Staff sign-in mode.
2. Validate the exact versioned QR format locally. Never navigate to scanned
   URLs, open web content, fetch a QR-provided host, or accept student ID cards.
3. Pause/lock scanning immediately. Make one bounded, non-cached unauthenticated
   exchange through the existing API layer, with the selected `roleHint`.
   A rejected/expired QR is not an expired mobile session: never trigger refresh
   rotation or automatically replay this single-use request on HTTP 401.
4. Validate the returned role against the selected mode and validate JWT identity
   using `readAppSession` before storage. Do not infer identity from QR content.
5. Call existing `AuthContext.login(role, accessToken, refreshToken,
   mustChangePassword)` for SecureStore persistence and account initialization.
   Navigate through the same Student/Staff dashboard flow as password login.
6. On cancellation or backgrounding, release the camera and abort pending network
   work. Do not persist a late response after the scanner was abandoned.
7. On a lost response, do not silently retry the same code: it might already
   have been consumed. Ask for a fresh code. A rejected response can re-enable
   the scanner without an application restart.

The API contract is available before mobile UI changes; it does not itself
implement or deploy the mobile scanner.

## Failure responses and limits

All errors use `{ "error": "<safe user-facing message>" }`.

| Status | Meaning |
| --- | --- |
| 400 | Malformed QR, unsupported QR version, invalid identifier/JSON/fields |
| 401 | Invalid session or QR; includes expired, consumed, revoked, unavailable account/tenant and wrong secret |
| 403 | Unsupported owner role, wrong selected sign-in type, or prohibited browser/CSRF request |
| 404 | Owner cannot find that challenge within the exact originating session |
| 413 | Authentication body exceeds 16 KiB |
| 415 | Redemption requires JSON |
| 429 | Shared rate limit reached; includes `Retry-After: 60` |
| 503 | Shared limiter or database/issuer unavailable; no successful authentication is implied |

All handled responses include `Cache-Control: no-store, private`,
`Pragma: no-cache`, `Referrer-Policy: no-referrer` and `nosniff`.
Success audit events contain account/tenant metadata, never challenge secrets
or issued tokens. Unexpected database errors are not logged with SQL parameters.

Per-minute shared Redis limits:

| Operation | Per trusted client IP | Per authenticated account |
| --- | ---: | ---: |
| Create | 60 | 10 |
| Redeem | 30 | Not applicable |
| Status | 120 | 40 |
| Revoke | 60 | 20 |

Account limits span IP addresses. Redis or expiry-command failures return 503;
there is no per-instance fallback for QR login. Existing password-login limits
and outage behavior remain unchanged. Reverse proxies must keep the existing
trusted-client-IP sanitization intact.

## Storage and lifecycle

`qr_login_challenges` stores a SHA-256 hash of a random 32-byte secret, UUID,
role/user/institution, originating refresh-token row ID, account fingerprint,
expiry and terminal timestamps. No reusable credentials or raw QR are stored.
The account fingerprint detects password changes/account recreation/campus
changes, independently of session revocation.

Source refresh-token locks serialize creation, cancellation and consumption
across replicas. Source logout, rotation, expiry and revoke-all invalidate
unused challenges. Consumption and issuance of the normal mobile refresh token
commit together. A database/issuer error rolls both back; a network failure
after commit does not reverse a completed login.

Hourly token maintenance deletes challenges expired over one day ago, at most
5,000 per pass. Expiry never depends on that job. Source-token cleanup cascades
to its challenge rows. Existing session lifetimes and access-token revocation
semantics are inherited without alteration.
