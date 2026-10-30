# Full database backup and new-server recovery

This replaces the Super Admin institution-backup controls. It does not replace the schools' existing automatic exports to their own Google Drives. School restore approvals are now under **School Restore Requests**. Central copies of school ZIPs are no longer produced by the school worker; existing remote files are untouched.

## Super Admin setup

Deploy the matching app, backup and migrator artifacts first. Apply **0087_database_backup_recovery.sql** using the normal migration runner. Readiness fails if required columns/jobs are missing. All earlier security migrations, dedicated encryption-key configuration and restricted runtime database grants still apply.

Configure the server's `GOOGLE_DRIVE_CENTRAL_CLIENT_ID`, `GOOGLE_DRIVE_CENTRAL_CLIENT_SECRET`, `GOOGLE_DRIVE_CENTRAL_REDIRECT_URI`, Gmail sender and dedicated credential-encryption key. Register the exact callback URL with the Google OAuth web application and enable Drive API. Keep its OAuth consent/authorization appropriate for long-term background use; an expired/revoked grant requires reconnection. These are deployment settings, never browser-supplied secrets.

In **Super Admin -> Database Backup & Recovery**:

1. Enter the current Super Admin password and click **Connect Google Drive**. The server consumes a signed, session-bound, one-use OAuth state and stores the returned refresh token encrypted. The browser never receives the token. It creates/finds `Nisaab360 Database Backups` in the connected account.
2. Enter the recovery email and request a verification code. Re-enter the current account password when required. Codes expire after 15 minutes, allow at most five guesses and cannot be reused. Changing the address requires verification before it becomes the active recipient. An existing verified address remains active while a replacement is pending.
3. Verify the code, then enable nightly backups. Use a mailbox protected with MFA, preferably separate from the Drive account.
4. Use **Back up now** once for a manual recovery rehearsal. It queues a real full backup; it is not a synthetic preview. No live backup was run by this implementation task.

Only the current Root Super Admin passes `platform.security` checks. Regular platform admins, employees and institution users cannot configure, queue or download full database backups. Sensitive setup/manual actions require current password verification and rate limiting.

## Schedule and processing

The backup container schedules **one snapshot at 02:00 Asia/Karachi**, implemented as **21:00 UTC**. There is no automatic startup backup. Its separate one-minute poll only claims explicitly requested manual jobs and retries password delivery. It does not create extra nightly snapshots. The nightly ID uses the Pakistan calendar date and prevents repeating that night's job. Manual and nightly requests can queue separately, while the local worker lock and PostgreSQL session advisory lock serialize execution.

The worker uses the operator database account to make a complete compressed custom-format `pg_dump --no-owner --no-acl`, then checks its catalog. The app builds a portable package and encrypts it with AES-256-GCM using a fresh **24-character, 144-bit** random password and per-file scrypt salt/IV. Only ciphertext is uploaded to Drive. Reserved Drive IDs, persisted digests and source identity preserve idempotency across upload retries.

A run becomes **COMPLETED** only after the encrypted upload's size/checksum/parent are verified and SMTP accepts the matching password email. The email contains the backup filename, unique backup ID, creation time, ciphertext checksum and password. It contains no backup attachment. SMTP acceptance does not establish inbox delivery; monitor the recovery mailbox and sender bounces, and test receipt during setup.

Password material is stored encrypted with the dedicated server credential key for delivery retries; it never enters the ordinary plaintext email outbox or API responses. Failed deliveries use exponential retry delays capped at one hour. Retries keep the same password and address for the existing artifact. Do not delete the previous backup while a replacement is incomplete. Configuration/key loss while delivery is pending still requires protected operator key escrow; pending password records are not independent off-server recovery copies.

## Retention and status

The default is the **latest two successful new-format packages**, shown as Latest successful and Previous successful. Deletion runs only after a new package has both a verified upload and an accepted password email. It only deletes recorded new-format backup IDs; unrelated Drive files, old fixed-password dumps and school files are untouched. Deleting a retained package also clears its encrypted per-file password from the database.

Incomplete uploads/password deliveries are preserved for investigation/retry and can temporarily exceed two files. The UI shows pending/failed jobs and recent history without exposing encryption material. A worker outage during the scheduled hour does not trigger a surprise daytime snapshot; use the manual button after investigating. Backup health has a 27-hour threshold and a first-start grace period; disabled/unconfigured backups do not establish disaster-recovery coverage.

## Contents and limits

A `.n360backup` file is a versioned authenticated recovery package, not an ordinary ZIP. Use the provided recovery tool.

It includes:

- The entire PostgreSQL application database: all institutions/campuses, accounts and password hashes, academic data, fees/payments/receipts, settings, audit records, database definitions/sequences and migration ledgers.
- A manifest with format/application/PostgreSQL version, backup identity, file lengths and SHA-256 digests.
- A fixed allowlist of required application secrets/configuration, including current/previous credential encryption keys, QR signing keys and legacy QR material, JWT signing configuration, configured Cloudinary/mail/Drive/provider integration settings. This recovery configuration is inside the encrypted package, never alongside the remote ciphertext.
- Regular files from `public/downloads`, including published installers/APKs. Symlinks, hardlinks, traversal, reserved device names and unsafe archive paths are rejected.

The package does **not** include Docker host/cloud credentials, PostgreSQL cluster roles/grants, runtime database passwords, Valkey contents, Caddy certificate state, full OS images or arbitrary host files. Recreate target database permissions and host infrastructure deliberately. Caddy can reissue certificates when DNS/challenges are configured. External Cloudinary/video files remain in their existing provider accounts; their database references are preserved. An independent provider-media backup is needed if protecting against deletion of those accounts/files.

Current bounds: PostgreSQL 16 target, at most 64 GiB encrypted input, 10,000 entries, 2 MiB manifest and 1 MiB recovery-configuration file. Database compression means restored PostgreSQL storage/WAL can be much larger than the archive; provision it independently. A future PostgreSQL/format upgrade needs a reviewed compatible recovery release. Published executable downloads must remain trusted artifacts.

## Recover on a new server

Recovery is independent of ordinary login and binds **only to 127.0.0.1**. No public production restore endpoint exists. Keep all apps, migration auto-start, payment reconciliation, receipt/email/push and restore workers stopped until the target is restored and reviewed.

1. Download the selected encrypted file and obtain its matching password email independently. Use a trusted backup; PostgreSQL restores execute SQL from the archive. Start from the same reviewed application release recorded in the manifest, or a rehearsed compatible release.
2. Prepare an **empty PostgreSQL 16 application database**, with a separate owner/operator login. Do not use `postgres`, `template0` or `template1`, PgBouncer, an existing app database or a target with any other active connections. Start only PostgreSQL initially, not the application stack that auto-runs migrations. When using the current host-published Compose PostgreSQL port, the local operator connection is typically `127.0.0.1:5433`, not Docker's internal `postgres:5432` address.
3. Create a private operator environment file outside served/build directories, readable only by its owner:

   ```dotenv
   RECOVERY_DATABASE_URL=postgres://OPERATOR:PRIVATE_PASSWORD@127.0.0.1:5433/NEW_EMPTY_APP_DATABASE
   RECOVERY_OUTPUT_DIRECTORY=/private/recovery-output/UNUSED_DIRECTORY
   RECOVERY_PORT=34871
   ```

   These are placeholders. Use proper URL encoding for actual credentials, never paste real values in shell commands/logs. The output parent must exist and the output directory must not exist. URL query options are refused; configure `PGSSLMODE` and `PGSSLROOTCERT` privately for a TLS-requiring target. Use `pg_restore` compatible with the PostgreSQL 16 dump format.

4. From a private source checkout with its existing dependencies and PostgreSQL client tools installed, start:

   ```sh
   node --env-file=/private/operator-recovery.env --import tsx scripts/database-recovery-server.ts
   ```

   Alternatively build the separate `database-recovery` Docker target or use the reviewed `nisaab360-recovery:<revision>` artifact produced by `scripts/build-release.mjs`. On Linux use host networking so its loopback listener remains private; mount a private writable recovery directory owned by the container's unprivileged user. This image is not started by normal Compose and is not the web image. `scripts/provision-runtime-role.mjs` is included for the subsequent explicit operator step.

5. Open the displayed loopback address and enter the one-time local access token from the private terminal. For a remote instance, use an SSH loopback tunnel, for example:

   ```sh
   ssh -N -L 34871:127.0.0.1:34871 operator@NEW_SERVER
   ```

   Do not publish the recovery port to the internet. The tool checks Host, Origin and the access token on every operation. It does not put credentials in URLs.

6. Upload the `.n360backup` file and enter the matching emailed password. The tool authenticates the complete ciphertext before extracting, checks bounded safe paths/hashes and the dump catalog, then inspects the target. Review the backup ID, creation time and recorded application version. Re-type the exact backup ID to confirm restoration.
7. The tool refuses non-empty or connected targets, restores with `pg_restore --no-owner --no-acl --exit-on-error --single-transaction`, and then transactionally revokes old refresh/device/QR/push bindings, cancels queued database backups and pauses restored email outbox work. User password hashes remain unchanged. Backups are disabled until the new deployment is reviewed. A persisted recovery-review flag also prevents background workers and backup-password retries from running before Root completes review. Review retained queue work deliberately before clearing this flag.
8. Read the private output directory. `recovery-secrets.json` is the authoritative lossless configuration; `recovery.env` provides convenient single-quoted values and comments for values requiring manual copying. Merge the recovered application keys/settings into the new server's secret store. Supply **new server-specific** database/Valkey/network settings. Do not regenerate the recovered decryption/printed-QR keys. Copy the recovered `downloads/` into the `app_downloads` volume with the web container's expected ownership (1001:1001).
9. Run `scripts/provision-runtime-role.mjs --apply` explicitly using the new migration-owner connection and new runtime credentials. The dump deliberately omits roles/ACLs. Run the matching migration artifact against the restored migration ledger; do not initialize a separate empty schema over it or replay old security cutovers manually.
10. Start the web replicas privately after applying the recovered settings. Background receipt/email/reminder, school-backup, institution-restore and payment-reconciliation workers check a persisted recovery-review gate and remain paused, even if started. In Super Admin, use **Finish recovery review** only after validation; it requires the current password. This does not place ordinary API actions in a sandbox: test only deliberate synthetic actions and keep payment initiation disabled during rehearsal.
11. Verify the new app privately: login, institution/campus isolation, totals/receipts, encrypted settings, private uploads/downloads and printed QR cards. Reconcile pending payments without replaying charges. Only then start the intended workers, verify Drive/mail, re-enable backups, and change DNS during the planned cutover. Old platform sessions require login again; users keep their passwords.

`RECOVERY_COMPLETE` is written only after the restore and session-finalization steps finish. The local listener shuts down after success. If the database restore committed but finalization or receipt writing failed, an existing database is still never overwritten: inspect the target and private output before retrying. A failed `pg_restore` uses a single transaction, but deliberately written private recovery files may remain. Do not delete either source server or backup as part of a retry.

Temporary recovery directories are private and cleaned after success/ordinary shutdown. A forced process/host kill can leave private plaintext temporary files; inspect and remove only the process-owned directory after recovery. Windows administrators must verify ACLs separately; POSIX file modes alone do not establish Windows ACL protection. Use protected disks for recovery work.

## Planned cutover and disaster recovery

A nightly snapshot only includes transactions committed at its snapshot time. A sudden failure can lose changes since the last successful backup, potentially longer than a day if failures are ignored. For a planned move, rehearse first, then pause **all** old-server writers, take the final manual backup, restore it, verify, and switch DNS. Keep old cached-DNS traffic read-only or forward it to the new server so there is one writable database. A nightly copy plus a DNS change alone does not provide zero data loss or guaranteed invisible migration.

## Validation for this change

Offline tests cover authenticated encryption and corruption, byte-for-byte recovery package contents/configuration/downloads, unsafe entry rejection, the real migration chain, email verification limits/replay, manual/nightly deduplication, SMTP-failure key preservation, retries/retention, API secret minimization, Root role boundaries, local recovery Host/Origin/token checks, inspection/confirmation and restore-command/session-finalization behavior. Recovery request tests use actual filesystem/crypto and isolated PostgreSQL WASM; HTTP listening, SMTP, Drive and the `pg_restore` subprocess are mocked. The new recovery suite passes 9 tests; the existing central-backup suite passes 9 with its optional native PostgreSQL test skipped. An additional offline Chromium fixture passes 9 UI workflow checks at each of 1280px and 390px without an application server. They do not establish a live Google/Gmail delivery or a real PostgreSQL 16 `pg_restore` rehearsal.

Before enabling production: validate Google consent/refresh, receive a password email, download/decrypt a manual test package, restore into a separate PostgreSQL 16 instance using the actual recovery image/binary, confirm target permissions and application behavior, and observe a real 02:00 PKT run. No production migration, real email/upload, application build, deployment or database restore was performed by this task.

Legacy `.dump.enc` files still use their original fixed password and the older recovery preparation tool. Their existing files/history were not converted or deleted. See `scripts/restore-central-drive-backup.ts`; it uses explicit legacy environment OAuth configuration for offline preparation and never imports a database itself.
