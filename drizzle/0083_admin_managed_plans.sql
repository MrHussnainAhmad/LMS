CREATE TABLE IF NOT EXISTS subscription_plans (
  id varchar(20) PRIMARY KEY,
  kind varchar(8) NOT NULL CHECK (kind IN ('PUBLIC','DEAL')),
  name varchar(120) NOT NULL,
  monthly_fee_paisa integer CHECK (monthly_fee_paisa >= 0),
  setup_fee_paisa integer CHECK (setup_fee_paisa >= 0),
  per_student_fee_paisa integer CHECK (per_student_fee_paisa >= 0),
  student_limit integer CHECK (student_limit > 0),
  student_count integer CHECK (student_count > 0),
  campus_limit integer CHECK (campus_limit > 0),
  platforms jsonb NOT NULL DEFAULT '[]',
  device_limit integer CHECK (device_limit > 0),
  platform_managed_campuses boolean NOT NULL DEFAULT false,
  audience varchar(160) NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 100,
  redeemed_institution_id integer REFERENCES institutions(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  archived_at timestamptz,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (student_count IS NULL OR student_limit IS NULL OR student_count <= student_limit),
  CHECK (kind <> 'DEAL' OR (student_count IS NOT NULL AND student_limit IS NOT NULL AND per_student_fee_paisa IS NOT NULL AND monthly_fee_paisa IS NOT NULL AND device_limit IS NOT NULL)),
  CHECK (kind <> 'DEAL' OR monthly_fee_paisa::bigint = per_student_fee_paisa::bigint * student_count)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_public_name_unique ON subscription_plans(lower(name)) WHERE kind='PUBLIC' AND archived_at IS NULL;
CREATE TABLE IF NOT EXISTS dealt_plan_codes (
  code_hash varchar(64) PRIMARY KEY,
  plan_id varchar(20) NOT NULL REFERENCES subscription_plans(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dealt_plan_codes_plan_idx ON dealt_plan_codes(plan_id);
CREATE INDEX IF NOT EXISTS dealt_plan_codes_expiry_idx ON dealt_plan_codes(expires_at) WHERE used_at IS NULL;
CREATE TABLE IF NOT EXISTS pricing_plan_changes (
  id serial PRIMARY KEY, plan_id varchar(20) NOT NULL,
  "before" jsonb, "after" jsonb, created_by integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pricing_notice_reads (
  user_role varchar(32) NOT NULL, user_id integer NOT NULL,
  last_change_id integer NOT NULL DEFAULT 0,
  PRIMARY KEY(user_role,user_id)
);
-- One-time import, not runtime defaults. Removed plans never reappear on restart.
INSERT INTO subscription_plans(id,kind,name,monthly_fee_paisa,setup_fee_paisa,per_student_fee_paisa,student_limit,campus_limit,platform_managed_campuses,audience,featured,sort_order,platforms) VALUES
 ('BASIC','PUBLIC','Basic',350000,500000,NULL,300,1,false,'Small schools',false,1,'["Nisaab360"]'),
 ('STANDARD','PUBLIC','Standard',650000,800000,NULL,800,3,false,'Growing schools',true,2,'["Nisaab360"]'),
 ('PREMIUM','PUBLIC','Premium',1100000,1200000,NULL,1500,5,false,'Large institutions',false,3,'["Nisaab360"]'),
 ('ENTERPRISE','PUBLIC','Enterprise',NULL,NULL,1100,NULL,NULL,true,'Multi-campus institutions',false,4,'["Nisaab360"]')
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS plan_device_sessions (
  id varchar(36) PRIMARY KEY,
  institution_id integer NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_role varchar(32) NOT NULL, user_id integer NOT NULL,
  refresh_token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_device_sessions_usage_idx ON plan_device_sessions(institution_id,expires_at) WHERE revoked_at IS NULL;

UPDATE institution_agreement_acceptances a SET snapshot=jsonb_set(a.snapshot,'{plan,definition}',
  jsonb_build_object('id',p.id,'kind',p.kind,'name',p.name,'monthlyFeePaisa',p.monthly_fee_paisa,
   'setupFeePaisa',p.setup_fee_paisa,'perStudentFeePaisa',p.per_student_fee_paisa,
   'studentLimit',p.student_limit,'studentCount',p.student_count,'campusLimit',p.campus_limit,
   'platforms',p.platforms,'deviceLimit',p.device_limit,'platformManagedCampuses',p.platform_managed_campuses,
   'audience',p.audience,'featured',p.featured,'revision',p.revision))
FROM subscription_plans p WHERE a.snapshot->'plan'->>'id'=p.id AND NOT (a.snapshot->'plan' ? 'definition');
