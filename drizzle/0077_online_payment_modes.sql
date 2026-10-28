-- Online/Manual are institution-wide; legacy institutions remain Manual.
ALTER TABLE institution_payment_gateways ADD COLUMN IF NOT EXISTS mode varchar(16) NOT NULL DEFAULT 'MANUAL';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='institution_payment_gateways'::regclass AND conname='institution_payment_gateways_mode_check') THEN
    ALTER TABLE institution_payment_gateways ADD CONSTRAINT institution_payment_gateways_mode_check CHECK (mode IN ('MANUAL','ONLINE'));
  END IF;
END $$;
-- Keep old provider records, including retired providers, as immutable history.
-- New integrations accept only JazzCash and Easypaisa in application validation.
ALTER TABLE gateway_payment_attempts ADD COLUMN IF NOT EXISTS initiation_started_at timestamp;
ALTER TABLE gateway_payment_attempts ADD COLUMN IF NOT EXISTS closed_at timestamp;
ALTER TABLE gateway_payment_attempts ADD COLUMN IF NOT EXISTS portal_origin text;
CREATE UNIQUE INDEX IF NOT EXISTS gateway_attempts_verified_reference_uidx
  ON gateway_payment_attempts(gateway,environment,merchant_id,provider_reference)
  WHERE environment='production' AND status IN ('PAID','REVIEW') AND provider_reference IS NOT NULL;
