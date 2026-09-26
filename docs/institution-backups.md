# Institution Google Drive backups

Institution backups are customer-owned exports and are separate from the PostgreSQL disaster-recovery backup in the `postgres-backup` container. The database backup service and its B2 layout are not changed by this feature.

## Destination and retention

After an institution connects Google Drive, the application creates:

```text
Nisaab360/
└── InstitutionName/
    └── InstitutionName Backup.zip
```

There is one visible current file per institution. Each nightly job creates a new ZIP, verifies the uploaded byte count, and updates/replaces the same Drive file. A failed job does not remove the previous successful file. Drive credentials and the ZIP password are encrypted in the LMS database; the password is never returned by the settings API.

## ZIP contents

The archive contains `data.jsonl`, `README.txt`, and `backup-info.json`. It includes rows belonging to that institution, including dependent child records, and deliberately excludes authentication hashes, tokens, reset secrets, push tokens, operational backup metadata, and email outbox rows. Cloudinary media binaries are not copied; the export preserves database media keys/URLs.

The archive is AES-256 password protected. The institution owner configures a password of 14–200 characters after connecting Drive. Since the worker must use it at midnight, it is encrypted with the application credential-encryption key rather than stored as a one-way hash.

## Flow

1. `GET /api/institution/settings/google-drive/connect` returns a Google OAuth authorization URL.
2. Google redirects to `/api/institution/settings/google-drive/callback`.
3. The callback exchanges the authorization code, creates/finds `Nisaab360/<InstitutionName>`, and stores the encrypted refresh token and folder ID.
4. `PUT /api/institution/settings/google-drive` stores/rotates the archive password.
5. The push-receipt worker queues approved institutions with both Drive credentials and a configured password, then processes jobs sequentially.
6. The job takes a repeatable-read tenant snapshot, creates the ZIP, uploads/replaces the single Drive file, verifies its size, and records a `gdrive:<file-id>` object key, checksum, counts, and timestamp.

## Operations

`npm run verify:backups` now checks completed institution job records against their Google Drive file IDs and expected sizes. The former institution B2 download/verify/restore endpoints return `410 Gone`; they must not be used for this workflow. If tenant restoration is needed, obtain the institution ZIP from Drive and implement/import it through a separately reviewed recovery process. Full database recovery remains the responsibility of the PostgreSQL backup runbook.
