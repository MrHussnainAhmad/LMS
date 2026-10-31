CREATE TABLE IF NOT EXISTS attendance_delegations (
  id serial PRIMARY KEY,
  institution_id integer NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  section_id integer NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  staff_id integer NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  assigned_by_role varchar(32) NOT NULL,
  assigned_by_id integer NOT NULL,
  revoked_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT attendance_delegations_section_date_unique UNIQUE (section_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_delegations_staff_date_idx
  ON attendance_delegations(institution_id, staff_id, date);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_by_role varchar(32);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_by_id integer;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_by_name varchar(255);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS marked_at timestamp;
