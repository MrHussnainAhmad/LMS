-- Keep only non-reversible fingerprints of issued codes so an old expired,
-- replaced or consumed capability can never be accidentally issued again.
CREATE TABLE IF NOT EXISTS dealt_code_fingerprints (
  code_hash varchar(64) PRIMARY KEY
);
INSERT INTO dealt_code_fingerprints(code_hash)
SELECT code_hash FROM dealt_plan_codes ON CONFLICT DO NOTHING;
