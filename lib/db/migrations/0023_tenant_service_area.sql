-- Marketing location fields for the public site templates.
--
-- The rendering template had "Essex & London" and "Grays, Thurrock" written into ~70 lines of
-- page copy and SEO, which meant a second rendering tenant would have advertised AMO's region.
-- These two columns hold that copy as data instead.
--
-- Deliberately separate from tenant_settings.city / address, which are the POSTAL address shown
-- on the contact page and in schema.org. A business can trade from one town and sell into a
-- whole region, and the copy needs to say both.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "service_area" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "service_base" text;--> statement-breakpoint

-- Backfill the one tenant whose live pages already said these words, so its published copy and
-- its Google Ads landing surface read exactly as they did before this change.
UPDATE "tenant_settings" s
SET "service_area" = COALESCE(s."service_area", 'Essex & London'),
    "service_base" = COALESCE(s."service_base", 'Grays, Thurrock')
FROM "tenants" t
WHERE s."tenant_id" = t."id" AND t."name" ILIKE '%AMO Rendering%';
