-- Forward-only addition. Existing fixed-password backup history remains readable.
ALTER TABLE central_backup_settings
 ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS restore_review_required boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS drive_credentials_encrypted text,
 ADD COLUMN IF NOT EXISTS drive_email text,
 ADD COLUMN IF NOT EXISTS drive_folder_id text,
 ADD COLUMN IF NOT EXISTS recovery_email text,
 ADD COLUMN IF NOT EXISTS recovery_email_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS pending_recovery_email text,
 ADD COLUMN IF NOT EXISTS email_verification_hash text,
 ADD COLUMN IF NOT EXISTS email_verification_expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS email_verification_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS oauth_state_hash text,
 ADD COLUMN IF NOT EXISTS oauth_state_expires_at timestamptz;
ALTER TABLE central_database_backups
 ADD COLUMN IF NOT EXISTS password_encrypted text,
 ADD COLUMN IF NOT EXISTS recovery_email text,
 ADD COLUMN IF NOT EXISTS password_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS drive_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS drive_folder_id text,
 ADD COLUMN IF NOT EXISTS package_version integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
 ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS next_delivery_at timestamptz;
CREATE TABLE IF NOT EXISTS central_backup_jobs (
 run_id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('NIGHTLY','MANUAL')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
 attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz, completed_at timestamptz, error text,
 requested_by integer REFERENCES super_admins(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS central_backup_jobs_one_active_idx ON central_backup_jobs (kind) WHERE status IN ('PENDING','RUNNING');
