-- Per-event, per-channel notification toggle columns (replaces coarse notify_* booleans)
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_new_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_new_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_survey_booked_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_survey_booked_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_sent_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_sent_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_accepted_email" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_accepted_sms" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_won_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_won_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_in_progress_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_in_progress_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_complete_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_complete_sms" boolean DEFAULT true;--> statement-breakpoint

-- Review request: switch from days to hours, add channel selector
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_delay_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_channel" text DEFAULT 'both';--> statement-breakpoint

-- Copy existing delay_days value to delay_hours (days * 24) where set
UPDATE "tenant_settings" SET "review_request_delay_hours" = "review_request_delay_days" * 24 WHERE "review_request_delay_days" IS NOT NULL;--> statement-breakpoint

-- Update review_request_enabled default to true for new rows
ALTER TABLE "tenant_settings" ALTER COLUMN "review_request_enabled" SET DEFAULT true;--> statement-breakpoint

-- Drop old coarse notification columns
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "notify_lead_new";--> statement-breakpoint
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "notify_lead_status_change";--> statement-breakpoint
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "notify_quote_status_change";--> statement-breakpoint
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "notify_project_status_change";--> statement-breakpoint
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "notify_project_complete";--> statement-breakpoint
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "review_request_delay_days";--> statement-breakpoint

-- Review request sent timestamp on projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "review_request_sent_at" timestamp with time zone;--> statement-breakpoint
