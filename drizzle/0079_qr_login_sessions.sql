-- Additive: ordinary password sessions remain unchanged.
CREATE TABLE IF NOT EXISTS qr_login_sessions (
 id varchar(36) PRIMARY KEY,
 user_role user_role NOT NULL,
 user_id integer NOT NULL,
 institution_id integer NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
 device_name varchar(120) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CONSTRAINT qr_login_sessions_role_check CHECK (user_role IN ('STUDENT','STAFF'))
);
CREATE INDEX IF NOT EXISTS qr_login_sessions_owner_idx ON qr_login_sessions(user_role,user_id,institution_id,created_at);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS qr_session_id varchar(36) REFERENCES qr_login_sessions(id);
CREATE INDEX IF NOT EXISTS refresh_tokens_qr_session_idx ON refresh_tokens(qr_session_id);
