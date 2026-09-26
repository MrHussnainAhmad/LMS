# Nisaab360 / LMS Backend: Project Architecture Guide

> **Purpose:** this is the starting point for understanding and safely changing this repository. It describes the current codebase as inspected on 21 September 2026. Follow links to the named source files for implementation-level detail; this guide is deliberately a map, not a replacement for the source of truth.

## 1. What this repository is

Despite its `lms-backend` name, this is a full-stack, multi-tenant school LMS and institutional-management product. One Next.js application hosts:

- public marketing, registration, blog, FAQ, software-download, pricing, and institution public websites;
- six authenticated portal experiences: super admin, employee, institution owner/admin, staff, student, and parent;
- 158 HTTP API route handlers and 115 page routes;
- PostgreSQL schema, migrations, background jobs, integrations, and production Docker/Caddy infrastructure.

The product uses subdomains to select a portal or an institution. For example, `student.nisaab360.app` is rewritten to the student portal, while `{institution-slug}.nisaab360.app` is rewritten to that institution's public site.

## 2. Technology and execution model

| Concern | Implementation |
| --- | --- |
| Web framework | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind, Radix UI, TanStack Query, Framer Motion, Recharts |
| Database | PostgreSQL 16 via `pg` and Drizzle ORM |
| Database pooling | PgBouncer transaction pooling; `src/db/index.ts` creates the app pool |
| Authentication | HMAC-SHA256 JWT access tokens (`jose`) + opaque rotating refresh tokens |
| Password hashing | Argon2id through `@node-rs/argon2` |
| Cache/rate limiting | Valkey/Redis via ioredis |
| Media/file services | Cloudinary; Backblaze B2/S3 for backups; tus upload client |
| Email | Nodemailer + React Email templates + database outbox |
| Payments | JazzCash, HBL Pay/Cybersource, and Easypaisa adapters |
| Deployment | Docker Compose, two Next replicas, Caddy, PostgreSQL, PgBouncer, Valkey and workers |

Most pages are React Server Components that query the database directly. Browser interactivity lives in client components and calls `/api/*` route handlers. Some operations use `src/app/actions/*` Server Actions. There is no separate Express/Nest API service.

## 3. Repository map

| Location | Responsibility |
| --- | --- |
| `src/app/` | App Router pages, layouts, Server Actions, API route handlers |
| `src/app/(public)/` | Landing, logins, registration, downloads, FAQ, pricing, agreement |
| `src/app/(superadmin)/sa/` | Platform administration |
| `src/app/(employee)/employee/` | Internal employee workspace |
| `src/app/(institution)/institution/` | Institution administration workspace |
| `src/app/(staff)/staff/` | Teacher/staff workspace |
| `src/app/(student)/student/` | Student workspace |
| `src/app/(parent)/parent/` | Parent workspace |
| `src/app/sites/[slug]/[[...path]]/` | Tenant public site, admissions/auth/payment journey |
| `src/app/api/` | HTTP API, grouped by actor/domain |
| `src/components/` | Reusable client/server presentation components |
| `src/lib/` | Auth, RBAC, tenancy, validation, payments, cache, files, email and domain logic |
| `src/db/schema.ts` | Drizzle schema: 82 tables and all PostgreSQL enums |
| `drizzle/*.sql` | Ordered schema migrations; do not hand-edit an already-applied migration |
| `scripts/` | Operational workers, migration, verification and maintenance scripts |
| `backup/` | Full PostgreSQL disaster-recovery image/scripts |
| `docs/` | Runbooks and integration documentation |
| `Dockerfile`, `docker-compose.yml`, `Caddyfile` | Production build, service topology and edge proxy |

Path aliases use `@/` for `src/`. The codebase uses the source file, not this document, as the authoritative behavior description.

## 4. Request lifecycle and routing

```text
Browser/mobile client
  -> Caddy (TLS, security headers, compression, trusted client IP, load balance)
  -> app or app2 Next.js replica
  -> src/proxy.ts (body-size ceiling, CORS, subdomain rewrite, page auth)
  -> page / Server Action / API route
  -> requireRole + session validation + rate limiting (for protected APIs)
  -> Drizzle -> PgBouncer -> PostgreSQL
                 \-> Valkey cache/rate-limit keys; Cloudinary/B2/email/payment providers as needed
```

`src/proxy.ts` is the edge gate for every dynamic request. It removes user-supplied internal session headers, handles API preflight/CORS, rejects declared oversized bodies, verifies an access token for page access, maps hosts to internal paths, enforces portal roles, redirects password-change-required accounts, and forwards a signed internal session payload to Server Components.

`src/lib/rbac.ts` is the API guard. `requireRole()` enforces body size, verifies the requesting account exists, validates the allowed role and password-change state, applies mutation rate limits, then passes `{ session }` to the handler. Tenant-scoped API code should call `getTenantContext(session)` and constrain every query/write by that institution ID.

## 5. Roles, tenant boundaries, and portals

| Role | Portal / primary scope |
| --- | --- |
| `SUPER_ADMIN` | `/sa`: platform users, institutions, platform content, backups, audit |
| `EMPLOYEE` | `/employee`: institution review/support and platform operational work |
| `INSTITUTION` | `/institution`: owner-level tenant administration |
| `INSTITUTION_ADMIN` | `/institution`: delegated admin; some owner-only settings are blocked |
| `STAFF` | `/staff`: teaching, attendance, marks, courses, tests, diary, leave |
| `STUDENT` | `/student`: learning, results, attendance, fees, profile, submissions |
| `PARENT` | `/parent`: selected child's attendance, results, fees, requests, timetable |

The tenant is the institution. The main tenant identity is `institutionId` in authenticated JWT claims and in most domain tables. Public sites resolve through a validated institution slug. See `src/lib/institution-domain.ts` for reserved names and validation, and `src/lib/institution-tenant.ts` for cached resolution. Never trust a client-provided institution ID when session context is available.

Graduated students are explicitly restricted in both proxy and API RBAC to profile, transcripts, attendance, dashboard and promotion-result functionality.

## 6. Authentication and security model

### Login/session

`src/app/api/auth/login/route.ts` authenticates the platform roles. It creates a five-day JWT access token and a server-stored, opaque refresh token. Tokens are written into secure, HTTP-only, same-site-lax cookies; the shared production subdomain scope is `.nisaab360.app`. Admission applicants have a separate `admission_session` cookie in `src/lib/admission-auth.ts`.

`src/lib/auth.ts` rotates refresh tokens atomically. A refresh token is hashed in the database and single-use; replay of a replaced token revokes all active refresh tokens for that account. `verifyUserExists()` provides account-liveness checks for normal API calls. The proxy's signed internal session headers avoid duplicating JWT work on server-rendered pages without accepting client-forged headers.

### Other controls

- Argon2id protects passwords; sensitive equality checks use timing-safe comparison.
- `src/lib/rate-limit.ts` applies Redis-backed limits, including login protection.
- `src/lib/http.ts` and the proxy enforce request-body limits.
- `src/lib/cors.ts` permits configured origins only; production validation forbids `*`.
- Caddy replaces forwarded client-IP headers and sets security headers. Do not reintroduce raw `X-Forwarded-For` trust.
- `src/lib/audit.ts` records auditable actions; `audit_logs` is the persistence table.
- `src/lib/upload-ownership.ts` and file-specific routes protect uploaded resources.
- `src/lib/production-env.ts` fails production startup for missing/placeholder secrets or unsafe connection configuration.

## 7. Database model

The full schema is in `src/db/schema.ts`; migrations live in `drizzle/`. Tables are grouped below by business capability. Most tenant records include `institutionId`, and indexes/unique constraints defined alongside the tables are part of the intended data contract.

| Area | Main tables |
| --- | --- |
| Platform identities | `superAdmins`, `employees`, `institutions`, `institutionOwners`, `institutionAdmins`, `accountDeletions` |
| Public institution presence | `institutionPublicProfiles`, `publicEvents`, `featuredInstitutions`, `platformPages`, `blogs`, `platformReviews`, `systemSettings` |
| Academic structure | `academicSessions`, `campuses`, `classes`, `sections`, `sectionGroups`, `subjects`, `institutionHolidays`, `gradingScales` |
| People and parent links | `staff`, `students`, `parentAccounts`, `parentStudents`, `institutionCustomRoles`, `staffTeachableSubjects` |
| Admissions | `admissionCycles`, `admissionOfferings`, `admissionApplicantAccounts`, `admissionApplications`, `admissionDocumentRequests`, `admissionAppointments`, `admissionApplicationEvents`, `admissionFeePayments`, `admissionEnrollments`, `studentAdmissionCounters` |
| Teaching/assessment | `staffAssignments`, `assignments`, `submissions`, `tests`, `marks`, `onlineTests`, `onlineTestQuestions`, `onlineTestSubmissions`, `batchExams`, `batchExamSubjects`, `batchExamResults` |
| Attendance and progression | `attendances`, `staffAttendances`, `studentPromotions`, `leaveRequests`, `diaries` |
| Communication/support | `announcements`, `announcementReads`, `notifications`, `expoPushTickets`, `tickets`, `ticketHistory`, `emailOutbox` |
| Fees and payments | `feeVouchers`, `feeVoucherCycles`, `feeHeads`, `classFeeItems`, `studentFeeAdjustments`, `feeInvoices`, `feeInvoiceItems`, `feePayments`, `feePaymentSubmissions`, `institutionPaymentGateways`, `gatewayPaymentAttempts` |
| Platform operations | `refreshTokens`, `accountLockouts`, `passwordResets`, `auditLogs`, `institutionBackups` |
| Courses/streaming | `courses`, `courseClasses`, `courseLectures`, `courseLectureProgress` |

Important enum-driven states include institution approval, attendance, promotion, academic status, online-test submission, announcements, profile/leave/ticket state, admissions workflow, and payment state. Read the enum values at the top of `schema.ts` before adding state transitions.

## 8. Feature flows

### Institution onboarding and public sites

Public registration hits `/api/institution/register`. Super admins/employees review the tenant, then the owner configures campuses, academics, staff, students, settings, branding, and the optional public site. `proxy.ts` converts an institution host into `/sites/[slug]`; that catch-all route serves the tenant public site, events, admissions and applicant account journeys.

### Admissions

Admissions combine configurable cycles/offerings, applicant accounts, applications, requested documents, tests/interviews, event history, fee handling, acceptance, and enrollment. Institution management lives under `/institution/admissions` and `/api/institution/admissions/*`; public/applicant access lives under `/api/public/admissions/*` and `src/app/sites/[slug]/[[...path]]/`. Review the status enum before changing this workflow, because the UI and validation rely on those states.

### Academics, teaching and learning

Institution users maintain the academic graph (campus -> class -> section -> subjects), staff assignments and timetables. Staff mark attendance, create assignments/courses/tests, and enter marks. Students consume courses, submit work, attempt online tests, view exams/results/transcripts, and see attendance. Parents read a selected child's permitted data.

### Fees and payment gateways

The fee domain builds fee heads/items, invoices/vouchers, adjustments, submissions and payments. `src/lib/payments/service.ts` orchestrates checkout, callback processing, payment status, and QR creation. Credentials are tenant-scoped and protected by `src/lib/payment-credentials.ts`; readiness additionally requires enabled production configuration and verified provider acceptance. Public return/webhook endpoints must retain signature/transaction verification and idempotency safeguards.

### Notifications and email

Announcements create user-facing notification records and optional push work. `push-receipt-worker` processes Expo receipt checks. Email is queued to `email_outbox`; `scripts/email-outbox-worker.ts` claims and sends batches. This avoids coupling a user request to SMTP availability.

### Backups and recovery

There are two intentionally separate layers. `postgres-backup` performs full-database disaster-recovery backups and is unchanged. Institution-level exports now use the Google Drive flow: an institution connects Drive once, chooses a password, and the worker creates one AES-256 ZIP containing only that tenant's non-authentication data. It stores the ZIP at `Nisaab360/<InstitutionName>/<InstitutionName> Backup.zip` and replaces that file after each successful nightly upload. The `institution_backups` table remains job/checksum history; `institution_google_drive_backups` stores encrypted Drive credentials, folder/file IDs, and last-run status. The retired B2 institution upload/restore/download paths are disabled.

## 9. API navigation

There are 158 route-handler files. Navigate by actor/domain rather than treating the API as one flat surface:

| Prefix | Purpose |
| --- | --- |
| `/api/auth/*` | platform login, refresh, logout, password change |
| `/api/me/*` | current-session brand, notifications, push, navigation/review state |
| `/api/admin/*`, `/api/sa/*` | platform content/administration and backups |
| `/api/employee/*` | employee institution review/public-site operations |
| `/api/institution/*` | tenant administration: academics, people, settings, fees, admissions, courses, exams, files |
| `/api/staff/*` | staff dashboard/profile/attendance/marks/courses/tests/assignments/leave/diary |
| `/api/student/*` | student dashboard/profile/learning/assessments/fees/attendance/timetable/submissions |
| `/api/parent/*` | parent portal and requests |
| `/api/public/*` | unauthenticated app version/software/admissions workflow |
| `/api/payments/*`, `/api/webhooks/*` | gateway returns and provider callbacks |
| `/api/cron/*` | secret-protected operational tasks |
| `/api/health`, `/api/ready`, `/api/version` | liveness/readiness/version probes |

The route handler itself is the best endpoint contract: it shows supported methods, Zod parsing, exact response shapes, authorization and query filtering. New protected handlers should use `requireRole`; new public handlers need equally explicit validation, rate limiting where appropriate, and CORS considerations.

## 10. Shared libraries and where to start

| Need | Start with |
| --- | --- |
| Auth/session | `src/lib/auth.ts`, `auth-edge.ts`, `auth-types.ts`, `jwt-secret.ts` |
| Authorization/tenant safety | `src/lib/rbac.ts`, `institution-tenant.ts`, `user.ts` |
| Schema/query shape | `src/db/schema.ts`, then the feature route/page |
| Input rules | `src/lib/validators/` |
| Cache invalidation | `src/lib/redis.ts` |
| Files/uploads | `cloudinary.ts`, `client-upload-file.ts`, `upload-ownership.ts`, `admission-files.ts` |
| Payments | `src/lib/payments/`, `payment-credentials.ts`, `docs/payment-gateway-setup.md` |
| Email/push | `email.ts`, `email-templates.ts`, `email-outbox.ts`, `notifications.ts` |
| Public website | `public-site-domain.ts`, `public-website-notices.ts`, `public-events.ts` |
| Audit/security checks | `audit.ts`, `scripts/verify-security-guards.ts`, `scripts/audit-tenant-scope.mjs` |

## 11. Runtime services and operations

`docker-compose.yml` defines the production topology:

1. `postgres` stores persistent application data; host access is loopback-only.
2. `pgbouncer` provides transaction pooling for application traffic.
3. `valkey` is disposable cache/rate-limit storage.
4. `migrate` runs the production migration script directly against PostgreSQL before app startup.
5. `app` and `app2` are independent Next standalone replicas.
6. `push-receipt-worker` processes push-provider receipts outside the web processes.
7. `caddy` terminates TLS, adds headers/compression, health-checks and load-balances replicas.
8. `postgres-backup` performs verified, retained full backups and B2 uploads.

`src/instrumentation.ts` validates production settings and registers shutdown cleanup. `Caddyfile` is security-sensitive: it defines certificate behavior, trusted proxies, client IP sanitization and public routing. Docker build stages also package standalone runtime and worker variants.

## 12. Configuration

Use `.env.example` as the non-secret checklist. Do not commit `.env` or place its values in documentation/logs. Key groups are:

- Core: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `DB_POOL_MAX`, `DEPLOYMENT_ENV`.
- Security: `JWT_SECRET`, `CRON_SECRET`, optional `STREAMING_CREDENTIALS_SECRET`.
- Domain/CORS: `NEXT_PUBLIC_APP_DOMAIN`, `PUBLIC_SITE_BASE_DOMAIN`, `API_ALLOWED_ORIGINS`.
- Media: Cloudinary variables; B2 keys/bucket/region for backups.
- Email: Gmail account and application password.
- Payments: origin, provider endpoints, verified-gateway flag, and encrypted tenant credentials.

`DATABASE_URL` is the application connection through PgBouncer; `DIRECT_URL` is the direct PostgreSQL connection used by migrations. Production validation explicitly rejects a PgBouncer `DIRECT_URL`.

## 13. Safe change checklist

Before altering a feature:

1. Find the page/component, API route, validator, schema table and any cache invalidation for that feature.
2. Preserve tenant filters on **reads, writes, deletes, joins and file access**. Never use an ID alone when it is tenant-owned.
3. Use Zod validation and `requireRole` for protected API routes.
4. Update/clear the cache through the relevant helper after changing cached data.
5. Treat payment callbacks, auth routes, uploads, cron endpoints and Caddy changes as security-sensitive.
6. For schema changes, create a new migration and verify it against the expected migration process. Do not modify deployed history.
7. Add or update a focused verification script/test where behavior is security, money, tenant isolation, or data-recovery critical.

Useful existing checks are `npm run lint`, `npm run lint:tenant`, `npm run verify:security`, `npm run verify:admissions`, `npm run verify:payments`, `npm run verify:backups`, and `npm run verify:refresh-tokens`. Consult `package.json` for the current command definitions. Do not assume a build is required for analysis-only work.

## 14. Reading order for a new maintainer

1. This guide, then `package.json`, `.env.example`, and `docker-compose.yml`.
2. `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/institution-tenant.ts`.
3. `src/db/schema.ts` and the relevant migrations.
4. One complete vertical slice: page -> client component -> API route -> validator -> schema -> cache invalidation.
5. Relevant runbook under `docs/` before working on payments, backups, or production deployment.

## 15. Important repository realities

- The README still describes Next.js 15/Neon/Upstash/Resend, whereas `package.json` and deployment code currently show Next.js 16, local PostgreSQL/PgBouncer/Valkey, and Nodemailer/Gmail. Treat the implementation/configuration as current; update the README when that discrepancy is addressed.
- `src/app/api/student/vouchers/route.ts` is intentionally retired; current student fee behavior is under `/api/student/fees`.
- The working tree may contain feature work not yet committed. Inspect `git status` before making changes, and do not overwrite unrelated modifications.

---

### Glossary

- **Institution / tenant:** an isolated school, college, or university customer.
- **Owner vs institution admin:** both access the tenant portal; owner-only safeguards apply to sensitive administration.
- **Applicant:** a person using the public admissions workflow, separate from a student until enrolled.
- **Portal:** the role-specific UI selected by a system subdomain and protected by proxy/RBAC.
- **Public site:** a tenant-branded site selected by its non-reserved subdomain.
- **Direct URL:** a database connection that bypasses PgBouncer, reserved for migration/administrative operations.
