-- Stripe alongside Square.
--
-- Square is live and configured for the tenants using it, so nothing here
-- touches it: every column is new and nullable, and a tenant with no Stripe
-- keys behaves exactly as it does today.
--
-- `payment_provider` is the tenant's choice of till. NULL means "work it out
-- from whichever set of credentials is complete", which is what keeps every
-- existing Square tenant working without anyone editing a settings page.
--
-- Stripe keys carry their own environment — pk_test/sk_test against
-- pk_live/sk_live — so there is no stripe_environment column to get out of step
-- with the keys, which is a mistake the Square pair can still make.

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "stripe_publishable_key" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "stripe_secret_key" text;
-- Used to verify webhook signatures. Optional: the payment path verifies the
-- charge by fetching it back from Stripe, so webhooks are reliability rather
-- than a dependency.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "stripe_webhook_secret" text;
-- 'square' | 'stripe' | NULL (auto-detect from whichever credentials are complete)
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "payment_provider" text;

-- Which till actually took the money, recorded per payment rather than inferred
-- from the tenant's current setting — a tenant that switches provider must not
-- retrospectively relabel payments the other one processed.
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "payment_provider" text;
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text;

-- Every payment already in the table was taken by Square; there was no other
-- option until now. Backfilled so reconciliation never meets a NULL it has to
-- guess about.
UPDATE "payment_links" SET "payment_provider" = 'square'
  WHERE "payment_provider" IS NULL AND "square_payment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "payment_links_stripe_intent_idx"
  ON "payment_links" ("stripe_payment_intent_id");
