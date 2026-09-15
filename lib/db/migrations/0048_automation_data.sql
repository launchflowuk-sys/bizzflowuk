-- The facts the new automations need before they can be honest.
--
-- Two of the rules in this batch cannot work on the data we already hold, and
-- writing them against a guess would have produced automations that fire on
-- nothing, or worse, on the wrong thing.
--
-- 1. RECURRING VISITS
--
-- "Remind me to book the annual boiler service" needs the platform to know
-- which services come round again and how often. A service already knows what
-- it is called and what it costs; it has never known that a gas safety check
-- is a yearly job and a bathroom refit is not. Without that the rule would
-- have to guess from the job title, which is how a customer gets asked to
-- rebook a kitchen.
--
-- 2. LATE SUPPLIER DELIVERIES
--
-- Chasing a merchant needs to know what was ordered and when it was promised.
-- An expense is already the record of a purchase, so it gets the two dates
-- rather than inventing a parallel orders table that a trade would then have
-- to keep up to date twice.
--
-- Keep this file ASCII.

-- How often this service comes round again, in months. NULL means it does not
-- -- which is the honest default, because most work is one-off and a default
-- of twelve would have quietly signed every tenant up to pestering customers
-- about a bathroom they finished last year.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "recurs_every_months" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_recurs_every_months_check'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_recurs_every_months_check"
      CHECK ("recurs_every_months" IS NULL
             OR ("recurs_every_months" >= 1 AND "recurs_every_months" <= 120));
  END IF;
END $$;

-- When the merchant said it would arrive, and when it actually did. Both
-- nullable: the overwhelming majority of expenses are a receipt for something
-- already in the van, and forcing a date on those would be asking a trade to
-- do paperwork for the software's benefit.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "expected_on" date;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "received_on" date;

-- The chase sweep asks one question: what was promised by now and has not
-- turned up? Partial, because only the handful of rows that are orders carry
-- an expected date at all.
CREATE INDEX IF NOT EXISTS "expenses_expected_idx"
  ON "expenses" ("tenant_id", "expected_on")
  WHERE "expected_on" IS NOT NULL AND "received_on" IS NULL;
