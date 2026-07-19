-- Construction (AMO Services) lead fields — nullable flat columns on leads,
-- populated only for construction-industry tenants. Rendering tenants leave these null.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "client_type" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_description" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "planning_status" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "has_drawings" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "urgency" text;--> statement-breakpoint
