# Institution backup and recovery runbook

## Storage layout

- `postgres-backups/disaster-recovery/backup-*.dump`: full-platform PostgreSQL disaster recovery.
- `postgres-backups/institutions/{id}-{username}/daily/`: daily tenant recovery snapshots, retained 30 days.
- `postgres-backups/institutions/{id}-{username}/monthly/`: monthly tenant recovery snapshots, retained 366 days.
- `postgres-backups/institutions/{id}-{username}/manual/`: super-admin recovery snapshots, retained 30 days.
- `postgres-backups/institutions/{id}-{username}/export/`: sanitized institution-facing exports, retained 30 days.

Every institution package is gzip-compressed JSON Lines with a header, tenant rows and a final manifest. B2 encrypts the private bucket at rest. Metadata stores its SHA-256 checksum, object size and record counts.

Recovery packages contain password hashes and must never be sent to an institution. Only `EXPORT` packages are institution-facing; authentication fields are removed.

## Schedule and monitoring

The background worker queues one daily and one monthly version for every approved institution. Unique period keys prevent duplicates after restarts. It processes one package per interval to avoid a database load spike. A job interrupted for two hours is returned to the queue.

The super-admin page is `/sa/backups`. A completed version must pass **Verify** before it is considered usable.

Validate the complete archive, tenant ownership, manifest and foreign-key restore order without changing any data:

```sh
docker compose exec push-receipt-worker ./node_modules/.bin/tsx scripts/restore-institution-backup.ts \
  --institution=12 --backup-id=81 --validate-only
```

## Restore one institution

Never restore directly because corruption is suspected. First inspect the affected institution and create a fresh **manual recovery backup** from `/sa/backups`. Wait for it to complete and verify it. The safety backup must be less than two hours old.

Run the restore inside the worker container using the target backup, current safety backup and acting super-admin ID:

```sh
docker compose exec push-receipt-worker ./node_modules/.bin/tsx scripts/restore-institution-backup.ts \
  --institution=12 \
  --backup-id=81 \
  --safety-backup-id=99 \
  --actor-id=1 \
  --confirm=RESTORE-INSTITUTION-12 \
  --apply
```

The command verifies tenant ownership and SHA-256, refuses export packages, takes a tenant advisory lock, stages all rows, orders tables by foreign keys and performs delete/insert/count verification in one transaction. Any error rolls the complete restore back. The platform-level institution identity and backup history are preserved.

After restore, verify student/staff counts, fees, admissions and recent attendance before reopening institution access. Clear tenant caches or restart the application replicas if stale cache entries remain.

## What is not copied

Institution snapshots preserve Cloudinary file keys and URLs but do not duplicate Cloudinary binary objects. Cloudinary media requires a separate replication policy if recovery from accidental Cloudinary deletion is required. Valkey is a disposable cache and is intentionally not backed up.
