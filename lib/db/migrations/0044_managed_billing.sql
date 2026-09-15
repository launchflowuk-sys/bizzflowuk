-- Per-tenant billing arrangements.
--
-- The platform sells one self-serve plan at 99 GBP a month through Stripe
-- Checkout, and the subscription screen had that price hard-coded. That is
-- wrong for any tenant on a negotiated deal, and the first one already exists:
-- a tenant paying 165 a month for the platform plus a managed ad campaign,
-- invoiced directly and not through Checkout at all. Showing that owner a
-- "Start my subscription - 99 a month" button would have taken a second,
-- wrong payment from a customer who is already paying more.
--
-- Two independent things are being recorded here, and keeping them apart
-- matters:
--
--   billing_mode      WHO collects the money. 'self_serve' means Stripe
--                     Checkout, the default, and nothing changes. 'managed'
--                     means we invoice them outside the platform, so the
--                     subscribe button must not appear and the checkout
--                     endpoint must refuse.
--   billing_price_gbp WHAT they pay. NULL means the platform's standard price.
--                     A value overrides it for display only - it never drives
--                     a charge, because the charge comes from the Stripe price
--                     id, which is authoritative.
--
-- A managed tenant is therefore not a tenant with billing switched off. They
-- see what they are paying and what it covers, which is the whole point: the
-- screen has to tell the truth for them too.
--
-- Keep this file ASCII.

-- 'self_serve' | 'managed'. NOT NULL with a default so every existing tenant
-- keeps the behaviour it has today and no read has to cope with a null.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_mode" text NOT NULL DEFAULT 'self_serve';

-- Display-only override of the standard monthly price. NULL = standard.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_price_gbp" numeric(8,2);

-- What the arrangement covers, in the owner's words, shown on their billing
-- screen. Without this a managed tenant sees a price with no explanation of
-- why it differs from the advertised one.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_note" text;

-- Only the two known modes. A typo here would silently expose a paying
-- customer to a second charge, which is exactly the failure this migration
-- exists to prevent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_billing_mode_check'
  ) THEN
    ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_billing_mode_check"
      CHECK ("billing_mode" IN ('self_serve', 'managed'));
  END IF;
END $$;
