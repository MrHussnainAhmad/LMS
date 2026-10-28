-- New enum values are only used after this migration commits.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TIMETABLE';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FEE_VOUCHER';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FEE_OVERDUE';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ASSIGNMENT_REMINDER';
ALTER TABLE parent_accounts ADD COLUMN IF NOT EXISTS announcement_push_notifications_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key varchar(128);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS student_id integer REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_unique ON notifications(institution_id,user_role,user_id,event_key);
CREATE TABLE IF NOT EXISTS push_devices (
 id serial PRIMARY KEY, institution_id integer NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
 user_role user_role NOT NULL, user_id integer NOT NULL, token varchar(255) NOT NULL UNIQUE,
 project_id varchar(36) NOT NULL, session_token_hash varchar(64) NOT NULL, device_name varchar(120),
 revoked_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT push_devices_role_check CHECK (user_role IN ('STUDENT','STAFF','PARENT'))
);
CREATE INDEX IF NOT EXISTS push_devices_owner_idx ON push_devices(institution_id,user_role,user_id);
CREATE INDEX IF NOT EXISTS push_devices_session_idx ON push_devices(session_token_hash);
CREATE INDEX IF NOT EXISTS fee_invoices_reminder_idx ON fee_invoices(due_date,id) WHERE status IN ('DUE','PARTIAL');
CREATE INDEX IF NOT EXISTS assignments_due_reminder_idx ON assignments(due_at,id);
CREATE TABLE IF NOT EXISTS notification_rollout(id boolean PRIMARY KEY DEFAULT true,activated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO notification_rollout(id)VALUES(true)ON CONFLICT DO NOTHING;
