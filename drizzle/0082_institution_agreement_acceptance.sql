-- Existing institutions remain without a recorded acceptance; do not fabricate consent.
CREATE TABLE IF NOT EXISTS institution_agreement_acceptances (
  institution_id integer PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  agreement_version varchar(40) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  representative_name varchar(255) NOT NULL,
  contact_email varchar(255) NOT NULL,
  snapshot jsonb NOT NULL
);
