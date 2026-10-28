-- Forward-only; no existing authentication records are changed.
CREATE TABLE IF NOT EXISTS qr_login_challenges (
  id varchar(36) PRIMARY KEY,
  secret_hash varchar(64) NOT NULL,
  user_role user_role NOT NULL,
  user_id integer NOT NULL,
  institution_id integer NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  source_refresh_token_id integer NOT NULL REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  account_fingerprint varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_login_challenges_role_check CHECK (user_role IN ('STUDENT','STAFF')),
  CONSTRAINT qr_login_challenges_terminal_check CHECK (consumed_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX IF NOT EXISTS qr_login_challenges_source_idx ON qr_login_challenges(source_refresh_token_id);
CREATE INDEX IF NOT EXISTS qr_login_challenges_expiry_idx ON qr_login_challenges(expires_at);
