ALTER TYPE "lead_source" ADD VALUE IF NOT EXISTS 'Cost Calculator';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "estimate_items" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "estimate_total" numeric(10, 2);
