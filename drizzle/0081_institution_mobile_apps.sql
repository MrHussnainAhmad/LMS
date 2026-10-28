-- Additive rollout: preserve existing customers' access and existing web sessions.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS apps_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS client_type varchar(8) NOT NULL DEFAULT 'WEB';
