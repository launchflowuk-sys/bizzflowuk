ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_ads_conversion_id" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_ads_conversion_label" text;
