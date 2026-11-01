ALTER TABLE "academic_sessions" ADD COLUMN "record" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD COLUMN "response" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "response_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN "plan" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD COLUMN "coverage" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "support_record" jsonb DEFAULT '{}'::jsonb NOT NULL;