-- Remove only the legacy Dealed requirement for a device allowance.
-- Preserve plan records, accepted agreement snapshots and session revocation data.
DO $$
DECLARE legacy_check record;
BEGIN
  FOR legacy_check IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'subscription_plans'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%device_limit%'
      AND pg_get_constraintdef(oid) LIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE subscription_plans DROP CONSTRAINT %I', legacy_check.conname);
  END LOOP;
END $$;

ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_deal_required_fields;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_deal_required_fields
  CHECK (kind <> 'DEAL' OR (student_count IS NOT NULL AND student_limit IS NOT NULL
    AND per_student_fee_paisa IS NOT NULL AND monthly_fee_paisa IS NOT NULL));
