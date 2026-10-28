# Mobile notifications: implementation and activation

Implemented locally for `lms-backend`, `Taleem360-App` (Students/Staff), and
`Lms-app-parent` (Parents). No production deployment, native build, EAS build,
production credential change, or live-database operation was performed.

## Delivery model

Business events create durable inbox records and dispatch directly to Expo Push
Service after the request's database transaction commits. Expo forwards the push
to FCM/APNs. There is no application push delivery queue, pending-job array, or
scheduled event-dispatch worker. Student/Staff and Parent projects are sent in
separate requests, with at most 100 messages per request.

The existing receipt worker checks outcomes of pushes already accepted by Expo;
its `PENDING` tickets are receipt tracking, not unsent push jobs. It also runs an
independent clock check immediately at startup and every 15 minutes for events
that become due with time. Long backup maintenance does not block that clock.

Direct delivery is best effort. If the web process dies before dispatch or Expo
is unavailable, the inbox record remains, but there is no durable automatic
push replay. Provider acceptance does not prove arrival on the phone. Internet,
OS permissions, force-stop/battery restrictions and provider availability affect
arrival time; exact instant delivery cannot be guaranteed.

## Implemented notification list

| Event | Student | Staff | Parent |
| --- | --- | --- | --- |
| New assignment | Yes | — | — |
| Assignment deadline within 24 hours, not submitted | Yes | — | — |
| Published assessment/exam results | Yes | — | Linked child |
| Timetable changes | Affected class | Assigned teachers | Linked child |
| Exam scheduled, updated or cancelled | Targeted recipients | Targeted recipients | Linked child |
| Online test available | Targeted section | — | — |
| Daily diary | Affected class | — | Linked child |
| Own leave approval/rejection | Yes | Yes | Linked child |
| Student/parent leave request | — | Assigned class teacher | — |
| Approved student leave affecting a class | — | Class teacher | Linked child through leave decision |
| Institution announcements/updates | Targeted recipients | Targeted recipients | Linked child |
| Fee voucher created | Yes | — | Linked child |
| Fee overdue | Yes | — | Linked child |
| Fee payment confirmed / manual proof rejected with reason | Yes | — | Linked child |
| New registered mobile device, QR sign-in, password/security changes | Yes | Yes | Yes, excluding unsupported Parent QR login |
| Present, absent, late, or leave attendance | — | — | Linked child |

Results are notified only when published/visible, not while marks are drafts.
Batch exam notification waits for the complete transcript to be visible.
The migration records a rollout timestamp to avoid flooding users with historic
batch-result notifications. Existing unpaid overdue vouchers can generate their
first overdue alert after rollout. No historical event backfill is otherwise run.

Reminders are once per assignment/student or invoice/due date, not daily nagging.
Fee due dates use `Asia/Karachi`; checks process up to 500 recipients per event
category per pass. At larger volumes, additional passes are required. Exam review
deadlines are also checked by the clock when they make a transcript visible.

## Security and app behavior

- Each device is associated with an authenticated account, institution, Expo
  project and hashed refresh-session binding. Refresh rotation updates the
  binding. Logout/unregister disables the device. Expired/revoked sessions and
  revoked QR sessions cannot receive ordinary pushes through the new binding.
- Security alerts can reach an otherwise unexpired device after its refresh
  token was revoked by a password change; an explicitly logged-out device is
  excluded. Existing legacy single-token Student/Staff clients remain compatible
  during rollout, but only updated clients provide per-session device behavior.
- Parent recipients and inbox reads recheck current child links and tenant
  ownership. Disabling an account or institution prevents delivery.
- Unique database event keys suppress duplicate events across web replicas and
  simultaneous clock checks. Multiple devices per account remain supported.
- Announcement/test preferences are respected. Phone permission denial does
  not remove the in-app inbox. Unsupported Expo Go/web/native-module environments
  avoid evaluating unsupported native notification code.
- Mobile taps use a semantic allowlist, validate account/tenant, and select the
  linked child. Scanned or received arbitrary URLs are never opened. Foreground
  notifications for another/signed-out account are suppressed.
- Inbox screens load on focus, refresh without cached responses, react to
  incoming pushes, and remove listeners when unmounted. No idle API polling is
  introduced. A push received during an inbox fetch triggers another fresh load.
- Device credentials, refresh tokens and push tokens are not logged.

## Actual API contract

These extend the existing authenticated API client and session handling.

| Route | Contract |
| --- | --- |
| `GET /api/me/push-token` | Student/Staff/Parent; returns `{hasPushToken:boolean}`. |
| `POST /api/me/push-token` | Student/Staff/Parent; JSON `{token,projectId,refreshToken,deviceName?}`; Expo token, project UUID, current 80-hex refresh token, optional device name up to 120 characters. Returns `{success:true}`. Session-binding mismatch: 403; malformed input: 400; rate limit: 429. Legacy token-only Student/Staff registration is retained. |
| `DELETE /api/me/push-token` | JSON `{token}`; disables only the caller's matching device and clears its matching legacy binding. |
| `GET /api/me/push-preferences` | Existing role-specific preference response, now supports Parent announcement preferences. |
| `PATCH /api/me/push-preferences` | Existing role-specific announcement/test preference keys; Parent supports announcement preferences. |
| `GET /api/me/notifications` | Existing inbox contract (`?fresh=1` invalidates old server cache before refilling), now supports Parents; records include optional `studentId` and semantic `data`. |
| `PATCH /api/me/notifications` | JSON `{notificationIds:[...]}` marks only authorized records as read. |
| `PATCH /api/me/notifications/read-all` | Marks caller's authorized inbox records read. |
| `GET /api/me/notifications/unread-count` | Existing unread count response, now supports Parents. |
| `POST /api/cron/notification-reminders` | Optional external clock trigger; `Authorization: Bearer <CRON_SECRET>`; returns `{events,notifications}`. The Compose worker already runs this logic internally; no second schedule is required. |

Push `data` includes `notificationId`, `type`, `screen`, `referenceId`, optional
`studentId`, `institutionId`, `userRole`, and `userId`. The server determines these
values. Notification taps use existing role screens; Parent exam notices open
the timetable, which includes exam information. Result taps can pin the referenced
published assessment/transcript without being hidden by the current period filter.

## Your setup work

1. **Review and deploy the backend changes first.** Use the existing release
   process in [deployment/README.md](../deployment/README.md). Take the usual
   database backup, run the normal migrator, then update both `app`/`app2` and
   `push-receipt-worker` to matching release artifacts. Migration
   `0080_mobile_notifications.sql` is registered in that migrator. Other pending
   migrations in this working tree also need review. Do not manually paste SQL.
2. **Link a separate EAS project for each mobile app.** Taleem360 already declares
   its project ID in `app.json`. Parent needs its own real project ID: run
   `npx eas-cli@latest login` and `npx eas-cli@latest init` inside that app, or
   configure its real `extra.eas.projectId`/`EXPO_PUBLIC_EAS_PROJECT_ID`. Do not
   reuse Taleem360's EAS project identity for Parent.
3. **Register both Android applications in Firebase.** They can use one Firebase
   project with two Android apps, or separate projects. Match these package IDs:
   - Taleem360: `com.hussnainahmadsahi.taleem360`
   - Parent: `com.hussnainahmadsahi.nisaab360.parent`
   Download each app's matching `google-services.json` into that app's root.
   These files are ignored by Git and included by the EAS upload configuration.
   The Parent dynamic config enables its file when present. They are client
   configuration, not the private service-account key.
4. **Configure FCM V1 credentials privately in each EAS project.** In each app run
   `npx eas-cli@latest credentials -p android`, choose Google Service Account /
   Push Notifications (FCM V1), and upload the appropriate private service-account
   key. Keep that private JSON outside the repositories and app build inputs.
   Enable the required Firebase Cloud Messaging API if prompted. Do not send the
   private key to this chat. For iOS, configure each app's Apple/APNs credentials
   separately before shipping iOS.
5. **Optional enhanced Expo push security:** if enabled for these projects, set
   the backend's private `EXPO_ACCESS_TOKEN` to an authorized Expo access token.
   Compose passes it to both web replicas and the receipt worker. The token must
   have access to both projects; separate Expo-account arrangements may require
   separate provider configuration. Leave it empty if enhanced security is not
   enabled. Firebase private keys are not required in the Next.js `.env` for this
   Expo transport.
6. **Install real app builds.** In each app run `npm ci` with network access, then
   `npx eas-cli@latest build --platform android --profile preview` when ready.
   Install the resulting APK and allow notifications. This command is for you;
   no native build was run during implementation. Expo Go cannot test this
   implementation's remote pushes. A native dependency/configuration change
   requires rebuilding the installed app, not just reloading JavaScript.
7. **Perform the acceptance test below.** Keep the phone online and ensure its
   API address reaches the same backend receiving institution changes. Both development and release
   apps now use `https://nisaab360.app`; environment API overrides are disabled.
   Local backend testing requires an explicit source configuration change.

Official references checked for this implementation:
[Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/),
[FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/),
[sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/),
[SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).

## Verification actually performed

| Check | Result |
| --- | --- |
| Backend isolated PostgreSQL/WASM migration, SQL and HTTP notification fixture | 11 groups passed; real application queries/handlers, mocked auth/provider transport. Fresh/idempotent migration, multi-device/project delivery, tenant/child isolation, dedupe, logout/legacy cleanup, preferences, transaction rollback, event helpers, publication gating, provider failures and reminders. |
| Taleem360 notification scripts | 9 groups passed: native startup guards, permissions/registration, identity suppression, safe navigation, foreground inbox refresh, duplicate taps, listener cleanup/resume. |
| Parent notification scripts | Same 9 groups passed. |
| Online payment regression | 18 tests passed; notification adapter mocked in this existing isolated fixture. |
| Existing fee billing, QR login and mobile access/Parent portal regressions | Passed during implementation; dedicated notification tests exercise actual delivery queries. |
| TypeScript checks | All three repositories passed. |
| Parent full lint | Passed. |
| Notification-related targeted lint, both apps and backend | Passed. |
| Taleem360 full lint | Blocked by 48 existing errors and 26 warnings across other screens/hooks; the notification-related targeted check passes. |
| Android development JavaScript export, both apps | Passed; ignored `.expo/bundle-check/android` outputs only, no APK/AAB/iOS/native build. |
| Local application migration | 0080 applied to loopback-only local database, not production. |
| Live localhost readiness | Not verified: no server was reachable on port 3000 at final check. |
| Real FCM/APNs delivery, native permission UI, background/terminated device behavior | Not tested; requires your credentials and installed native builds. |

The Parent dependency installation encountered local network/cache restrictions.
Matching installed SDK 57 packages from Taleem360 were used for local checks;
the Parent lockfile uses normal registry versions/integrity entries, not machine
paths. Perform a normal clean `npm ci` before building.

## Device acceptance test and rollback

With Student, assigned Staff and linked Parent signed in, create an assignment,
publish a result, change a timetable, schedule/update an exam, add a diary entry,
submit/approve/reject leave, publish a targeted announcement, create a voucher,
confirm/reject payment, and mark attendance. Check intended recipients only,
one event per recipient, correct child after tapping, foreground/background and
closed-app delivery, multiple devices, disabled preferences, permission denial,
logout, revoked QR session and a different institution/account. Exercise deadline
and overdue checks with controlled nonproduction records. Check Expo receipts
as well as visible banners and inbox records.

Monitor generic `[notifications]` errors and receipt failures; no new external
alerting service is configured. Keep the worker running for time-based alerts.
During an outage, inbox retrieval remains the recovery path for missed pushes.

For application rollback, restore prior app/worker release artifacts together;
retain the additive migration and existing notification/device rows. Do not drop
new tables/columns or restore an old database over live data. Older code will not
support Parent push delivery or new per-session device bindings. Keep that
limitation in mind before rolling back deployed mobile clients.

## Source map

- Backend schema/migration: `src/db/schema.ts`,
  `drizzle/0080_mobile_notifications.sql`, `scripts/migrate-production.mjs`.
- Delivery/events/reminders: `src/lib/notification-delivery.ts`,
  `src/lib/notification-events.ts`, `src/lib/notification-reminders.ts`,
  `src/lib/notifications.ts`, `scripts/push-receipt-worker.ts`.
- API/session integration: `src/app/api/me/{push-token,push-preferences,notifications}`,
  `src/app/api/cron/notification-reminders`, `src/lib/auth.ts`,
  `src/app/api/parent/portal/route.ts`; event calls in existing timetable,
  assessment, assignment, test, leave, attendance, fee/payment, password/reset and
  QR authentication routes/actions. No replacement authentication system.
- Configuration/tests: `.env.example`, `docker-compose.yml`, `.gitignore`,
  `package.json`, `scripts/verify-local.mjs`, `scripts/verify-mobile-notifications.ts`,
  fixture updates in existing billing/payment/QR tests.
- Both mobile apps: `src/utils/notifications.ts`,
  `src/utils/notification-navigation.ts`, `src/components/NotificationBridge.tsx`,
  `src/app/notifications.tsx`, root layout, auth context/policy, package scripts,
  `scripts/verify-notification-{startup,navigation,interactions}.mjs` and existing
  auth fixture mocks.
- Parent additionally: notification dependency/lockfile/plugin, `app.config.js`,
  `eas.json`, `.easignore`, `.gitignore`, `.env.example`, API environment selection,
  settings permission action, home bell, Parent portal context and result targets.

Unrelated existing work in all three repositories is preserved. No files were
staged, committed or pushed as part of this task.
