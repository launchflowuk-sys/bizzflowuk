-- Landscaping/groundworks lead fields (KD Essex, tenant #3).
-- Nullable and additive, populated only for landscaping-industry tenants — same pattern as the
-- construction fields added for AMO Services. IF NOT EXISTS so this is safe to re-run.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "garden_size" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "current_surface" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "level_change" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "drainage_issues" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "waste_removal" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "desired_features" jsonb DEFAULT '[]'::jsonb;
