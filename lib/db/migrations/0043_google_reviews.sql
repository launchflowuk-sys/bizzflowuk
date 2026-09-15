-- Google reviews, pulled onto a tenant's own site.
--
-- A trade's reviews live on Google, where customers put them, and the website
-- shows nothing. Asking the owner to retype them is both tedious and dishonest
-- -- retyped reviews are not reviews. Pulling them means what the site shows is
-- what Google shows.
--
-- Two things about Google's API that shape this table:
--
--   1. Place Details returns a MAXIMUM of five reviews, chosen by Google. There
--      is no way to get all of them. That is their limit, not ours.
--   2. Google's terms allow caching a Place ID indefinitely but other place
--      content only briefly, so these rows are a refreshable cache and not a
--      permanent copy. `synced_at` is what makes staleness visible.
--
-- Keep this file ASCII.

-- Where to pull from. The owner pastes this from their Google Business profile.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_place_id" text;
-- The headline rating and count, which Google gives for the whole place and is
-- worth showing even though only five individual reviews come back.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_rating" numeric(2,1);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_review_count" integer;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "google_reviews_synced_at" timestamptz;

-- Identifies a pulled review so a re-sync updates it instead of adding it
-- again. Google does not expose a review id, so this is a hash of the author
-- and the time it was written, which is stable for the same review.
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "external_id" text;
-- When the customer actually wrote it, as opposed to when we pulled it.
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source_created_at" timestamptz;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "synced_at" timestamptz;

-- One row per external review per tenant. This is what makes the sync
-- idempotent: re-running it can only ever update, never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_tenant_external_idx"
  ON "reviews" ("tenant_id", "external_id") WHERE "external_id" IS NOT NULL;
