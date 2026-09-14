-- BPS coverage copy.
--
-- The areas were seeded with a name and a county and nothing else, so the
-- "Where we work" section could only render a row of identical chips and each
-- town page had no content to rank on. This backfills the per-town copy that
-- the seed now carries, for environments where BPS was seeded before it.
--
-- Only fills a description that is currently empty, so anything edited from the
-- dashboard is left alone, and re-running changes nothing.
UPDATE areas a
SET description = v.description,
    updated_at = now()
FROM (VALUES
  ('grays',            'Our home town. Most Grays jobs are seen the same day, and emergencies usually within the hour.'),
  ('thurrock',         'The whole borough, from Purfleet through to East Tilbury. Boilers, heating, bathrooms and landlord certificates.'),
  ('tilbury',          'Regular work across Tilbury and the riverside estates, including older systems that need patience rather than replacing.'),
  ('chafford-hundred', 'Mostly newer builds here — system boilers, pressure faults and bathroom refits.'),
  ('south-ockendon',   'Full plumbing and heating cover, with emergency call-outs evenings and weekends.'),
  ('corringham',       'Boiler installs, servicing and repairs across Corringham and Fobbing.'),
  ('stanford-le-hope', 'Heating systems, leaks and blockages, and annual landlord gas safety checks.'),
  ('basildon',         'Planned work and installations across Basildon — call to check timings for urgent jobs.')
) AS v(slug, description)
WHERE a.slug = v.slug
  AND (a.description IS NULL OR a.description = '')
  AND a.tenant_id IN (SELECT id FROM tenants WHERE slug = 'bps');
