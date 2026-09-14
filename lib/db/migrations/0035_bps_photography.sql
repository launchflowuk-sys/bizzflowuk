-- BPS photography.
--
-- The new site shipped with two images — a hero and a logo — while the old
-- WordPress site it replaces was full of real photographs of real jobs. Those
-- are the client's own assets and they were sitting in the handoff and on the
-- live site the whole time. 56 of them are now bundled under /bps/ as webp
-- (13MB of originals down to 2.5MB, averaging 44KB each).
--
-- Only fills an image that is currently empty, so anything set from the
-- dashboard is left alone and re-running changes nothing.

UPDATE services s
SET hero_image_url = v.img, updated_at = now()
FROM (VALUES
  ('boiler-installation',        '/bps/new-boiler-installation.webp'),
  ('boiler-repair',              '/bps/boiler-repair.webp'),
  ('boiler-servicing',           '/bps/essex-boiler-service.webp'),
  ('central-heating-installation','/bps/boiler-install.webp'),
  ('central-heating-repairs',    '/bps/ch1.webp'),
  ('radiator-repairs',           '/bps/rads-repairs-grays.webp'),
  ('bathroom-installation',      '/bps/kitchen.webp'),
  ('toilet-repairs',             '/bps/toilets.webp'),
  ('leaks-blockages',            '/bps/pflush-engineer.webp'),
  ('drainage-solutions',         '/bps/drains.webp'),
  ('gas-installation',           '/bps/gasmeter1.webp'),
  ('gas-safety-certificates',    '/bps/gas-certificates.webp')
) AS v(slug, img)
WHERE s.slug = v.slug
  AND (s.hero_image_url IS NULL OR s.hero_image_url = '')
  AND s.tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');

UPDATE areas a
SET hero_image_url = v.img, updated_at = now()
FROM (VALUES
  ('grays',      '/bps/bps-plumbers.webp'),
  ('romford',    '/bps/boilers-service-essex.webp'),
  ('hornchurch', '/bps/heater-1.webp'),
  ('basildon',   '/bps/new-boiler-1.webp'),
  ('brentwood',  '/bps/boiler-install-1.webp')
) AS v(slug, img)
WHERE a.slug = v.slug
  AND (a.hero_image_url IS NULL OR a.hero_image_url = '')
  AND a.tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');

UPDATE blog_posts b
SET hero_image_url = v.img, updated_at = now()
FROM (VALUES
  ('how-long-does-a-boiler-last',           '/bps/how-long-does-boiler-last.webp'),
  ('how-often-should-a-boiler-be-serviced', '/bps/shutterstock-1310136589-1.webp'),
  ('how-long-does-a-boiler-service-take',   '/bps/boiler-servicing.webp'),
  ('how-long-does-it-take-to-fit-a-boiler', '/bps/shutterstock-1499099210-1.webp'),
  ('what-size-boiler-do-i-need',            '/bps/man-repairing-a-boiler-machine.webp'),
  ('what-is-a-combi-boiler',                '/bps/man-fixing-combi-boiler.webp'),
  ('why-is-my-boiler-making-a-noise',       '/bps/boiler-noise.webp'),
  ('how-to-detect-a-gas-leak',              '/bps/gasmeter1.webp'),
  ('will-a-new-boiler-save-me-money',       '/bps/new-boiler.webp'),
  ('ways-to-increase-your-boilers-lifespan','/bps/boiler-lasting.webp'),
  ('benefits-of-a-boiler-service',          '/bps/heater-1.webp'),
  ('is-boiler-breakdown-cover-worth-it',    '/bps/bernard-hermant-ofcclmg4ozo-unsplash-1-1.webp'),
  ('signs-you-should-replace-your-plumbing','/bps/topmbg.webp'),
  ('plumbing-or-drainage-difference',       '/bps/drains.webp'),
  ('new-boiler-installation-guide',         '/bps/new-boiler-1.webp')
) AS v(slug, img)
WHERE b.slug = v.slug
  AND (b.hero_image_url IS NULL OR b.hero_image_url = '')
  AND b.tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');

-- The team photographs, for the About section.
UPDATE tenant_settings ts
SET about_image_url = '/bps/bps-plumbers.webp', updated_at = now()
WHERE (ts.about_image_url IS NULL OR ts.about_image_url = '')
  AND ts.tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');
