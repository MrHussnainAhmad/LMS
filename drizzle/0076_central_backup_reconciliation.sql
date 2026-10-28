-- Forward-only repair: keep unbounded legacy identifiers and historical fields.
-- Never truncate a run ID, filename or historical error to fit a newer model.
ALTER TABLE central_database_backups
  ADD COLUMN IF NOT EXISTS b2_status varchar(16),
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_sha256 varchar(64),
  ADD COLUMN IF NOT EXISTS source_size_bytes bigint;

UPDATE central_database_backups SET error = error_message
WHERE error IS NULL AND error_message IS NOT NULL;
UPDATE central_database_backups SET status = 'UPLOADING' WHERE status = 'IN_PROGRESS';
ALTER TABLE central_database_backups
  ALTER COLUMN run_id TYPE text,
  ALTER COLUMN file_name TYPE text,
  ALTER COLUMN drive_file_id TYPE text,
  ALTER COLUMN sha256 TYPE text,
  ALTER COLUMN status TYPE text,
  ALTER COLUMN status SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS central_database_backups_run_id_idx ON central_database_backups(run_id);
CREATE INDEX IF NOT EXISTS central_database_backups_status_idx ON central_database_backups(status);
CREATE INDEX IF NOT EXISTS central_database_backups_status_created_idx ON central_database_backups(status, created_at);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'central_database_backups'::regclass AND conname = 'central_database_backups_status_check') THEN
    ALTER TABLE central_database_backups ADD CONSTRAINT central_database_backups_status_check
      CHECK (status IN ('PENDING','UPLOADING','COMPLETED','FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'central_database_backups'::regclass AND conname = 'central_database_backups_b2_status_check') THEN
    ALTER TABLE central_database_backups ADD CONSTRAINT central_database_backups_b2_status_check
      CHECK (b2_status IN ('SKIPPED','UPLOADED','FAILED'));
  END IF;
END $$;
