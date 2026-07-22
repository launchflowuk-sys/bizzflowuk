-- Survey step fields on leads (sits between lead and quote).
-- Hand-authored + IF NOT EXISTS on purpose: prod was hotfixed manually after a missed migration,
-- so this must be safe to re-run there while still adding the columns to any other/fresh database.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "survey_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "survey_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "survey_notes" text;
