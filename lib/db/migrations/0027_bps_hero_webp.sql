-- BPS hero: 1.75MB PNG -> 72KB WebP.
--
-- The tenant seed only runs when the tenant row is missing, so it cannot fix a
-- tenant that has already been seeded. This corrects the stored path on any
-- environment where BPS was created before the WebP existed. Same pattern as
-- 0024/0025 for AMO Rendering.
--
-- Scoped by slug and guarded on the old value, so it is idempotent and cannot
-- touch a path someone has since changed from the dashboard.
UPDATE tenant_settings
SET hero_image_url = '/bps-team-van-hero.webp',
    updated_at = now()
WHERE hero_image_url = '/bps-team-van-hero.png'
  AND tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');
