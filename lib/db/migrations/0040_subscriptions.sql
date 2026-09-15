-- BizzFlowUK's own subscription: GBP 99/month with a 7-day trial.
--
-- Not to be confused with the Stripe columns added in 0038. Those are the
-- TENANT's own Stripe account, used to take money from THEIR customers. These
-- are about BizzFlowUK taking money from the tenant, through the platform's own
-- Stripe account. Two different accounts, two different directions of money,
-- and conflating them would let a tenant's key charge our subscription or the
-- other way round.
--
-- Every column is nullable. Existing tenants have no subscription and keep
-- working exactly as they do now; nobody gets locked out by this migration.

-- Stripe's customer for this tenant, on the PLATFORM account.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_customer_id" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_subscription_id" text;

-- Mirrors Stripe's subscription status: trialing | active | past_due |
-- canceled | incomplete | incomplete_expired | unpaid. Stored as text rather
-- than an enum on purpose -- Stripe can add a status and an ALTER TYPE to add
-- an enum value cannot run inside a transaction, which is the trap this
-- project has hit before.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_status" text;

-- When the free week runs out. Read straight from Stripe rather than computed
-- here, so the date shown in the dashboard is the date Stripe will actually
-- bill on.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamptz;

-- When the website team finished their site. The trial promise is "your site is
-- up inside the week", and this is how anyone can see whether that was kept.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "website_delivered_at" timestamptz;

CREATE INDEX IF NOT EXISTS "tenants_billing_customer_idx" ON "tenants" ("billing_customer_id");
CREATE INDEX IF NOT EXISTS "tenants_billing_subscription_idx" ON "tenants" ("billing_subscription_id");
