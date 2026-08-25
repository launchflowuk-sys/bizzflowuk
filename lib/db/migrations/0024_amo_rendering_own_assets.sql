-- Make AMO Rendering's own brand assets explicit data instead of template defaults.
--
-- The shared rendering template used to hardcode "/amo-logo-dark.webp", "/amo-logo-icon.webp" and
-- "/amo-team.webp" as its FALLBACKS, so every other tenant inherited AMO's logo and AMO's team
-- photograph. Those fallbacks have now been removed from the template.
--
-- AMO Rendering itself never had these fields populated -- its live site rendered purely off those
-- fallbacks. Removing them without this backfill would strip the logo and team photo from AMO's
-- own site. The files are unchanged and still served from web/public; we are only recording, as
-- data, the assets that were already being displayed.
--
-- COALESCE + a NULL guard keeps this idempotent and means it can never overwrite a value Shoji
-- later sets from the dashboard.
UPDATE "tenant_settings" s
SET "logo_url" = COALESCE(s."logo_url", '/amo-logo-dark.webp'),
    "about_image_url" = COALESCE(s."about_image_url", '/amo-team.webp')
FROM "tenants" t
WHERE s."tenant_id" = t."id"
  AND t."name" ILIKE '%AMO Rendering%';
