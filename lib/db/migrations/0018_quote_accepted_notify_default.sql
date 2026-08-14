-- Quote-accepted notifications defaulted to FALSE while every other notification defaulted to
-- TRUE. Tenants were therefore never alerted when a customer accepted a quote — the single most
-- commercially important event in the funnel. Flip the column default, and switch on the tenants
-- that are sitting on the old default (no tenant has ever been shown a reason to turn this off).

ALTER TABLE "tenant_settings" ALTER COLUMN "notify_quote_accepted_email" SET DEFAULT true;
ALTER TABLE "tenant_settings" ALTER COLUMN "notify_quote_accepted_sms" SET DEFAULT true;

UPDATE "tenant_settings" SET "notify_quote_accepted_email" = true
  WHERE "notify_quote_accepted_email" IS DISTINCT FROM true;
UPDATE "tenant_settings" SET "notify_quote_accepted_sms" = true
  WHERE "notify_quote_accepted_sms" IS DISTINCT FROM true;
