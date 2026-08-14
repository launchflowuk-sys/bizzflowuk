-- Customer-facing quote references were "QUO-1786711199250" — a raw millisecond timestamp, which
-- reads like a machine ID on a document a homeowner actually sees. Give each tenant its own short
-- prefix so references render as AMO-R-0001, AMO-S-0001, etc.
--
-- Existing quotes keep their old references untouched: they may already have been emailed to
-- customers, so rewriting them would break the reference on quotes people are holding. The new
-- sequence starts at 0001 alongside them.

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "quote_ref_prefix" text;

UPDATE "tenant_settings" SET "quote_ref_prefix" = 'AMO-R'
  WHERE "quote_ref_prefix" IS NULL
    AND "tenant_id" IN (SELECT id FROM "tenants" WHERE slug = 'amo-rendering');

UPDATE "tenant_settings" SET "quote_ref_prefix" = 'AMO-S'
  WHERE "quote_ref_prefix" IS NULL
    AND "tenant_id" IN (SELECT id FROM "tenants" WHERE slug = 'amo-services');
