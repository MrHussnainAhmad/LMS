ALTER TABLE plan_device_sessions ALTER COLUMN institution_id DROP NOT NULL;
-- One-time security cutover. All clients sign in again; old/default-credential sessions cannot survive rollout.
UPDATE refresh_tokens SET revoked_at=now() WHERE revoked_at IS NULL;
UPDATE plan_device_sessions SET revoked_at=now() WHERE revoked_at IS NULL;
UPDATE qr_login_sessions SET revoked_at=now() WHERE revoked_at IS NULL;
UPDATE push_devices SET revoked_at=now() WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS device_sessions_identity_idx ON plan_device_sessions(user_role,user_id);
