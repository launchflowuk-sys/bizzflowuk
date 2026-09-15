-- Invoices that repeat, and an invoice that says how to pay it.
--
-- Two gaps, both of which cost a trade real money.
--
-- 1. RECURRING WORK
--
-- A landlord gas safety round, a monthly maintenance contract, a quarterly
-- service call: the same invoice, to the same customer, on the same day of the
-- month, forever. Today every one of those has to be typed out again by hand,
-- which means sooner or later it is not typed out at all and the month is
-- simply not billed.
--
-- The model here is deliberately NOT a separate template table. The first
-- invoice in the series is a real invoice -- the customer really does get the
-- January one -- and it carries the schedule. Each cycle the engine clones it
-- into a new invoice that points back at the head through
-- recurrence_source_id. A template table would have meant a second items
-- table, a second totals path and two places for VAT to be worked out
-- differently, which is exactly how two numbers end up disagreeing on a
-- customer's paperwork.
--
-- Only the head row carries `recurrence`. The copies do not, or every copy
-- would start a series of its own and the tenant would wake up to a fork bomb
-- made of invoices.
--
-- 2. HOW TO PAY IT
--
-- invoice_terms and payment_days have been in tenant_settings since 0032 with
-- nothing reading or writing them, and there has never been anywhere to put a
-- sort code. So every invoice this platform has ever sent told the customer
-- what they owe and not one thing about how to pay it. For a trade being paid
-- by bank transfer that is the single most important block on the page.
--
-- Keep this file ASCII.

-- ---------------------------------------------------------------- recurrence

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence" text;
-- The date the next copy is due. Lives on the head row and is advanced by the
-- sweep, so "what is owed next" is one indexed read rather than a calculation
-- over history.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence_next_on" date;
-- Optional end of the series. Null means it runs until someone stops it.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence_until" date;
-- Off by default on purpose. A copy appearing as a draft for a person to
-- glance at is recoverable; an invoice sent to a customer automatically with
-- last month's wrong figure on it is not.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence_auto_send" boolean NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "recurrence_source_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_recurrence_source_id_fk'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_recurrence_source_id_fk"
      FOREIGN KEY ("recurrence_source_id") REFERENCES "public"."invoices"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- Text rather than an enum, for the same reason `status` is text: adding a
-- cadence later must never need ALTER TYPE ... ADD VALUE, which cannot run
-- inside a transaction on some Postgres versions and takes the whole migration
-- batch down with it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_recurrence_check'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_recurrence_check"
      CHECK ("recurrence" IS NULL OR "recurrence" IN
        ('weekly', 'fortnightly', 'monthly', 'quarterly', 'six_monthly', 'yearly'));
  END IF;
END $$;

-- The sweep asks one question daily across every tenant: which series are due?
-- Partial, because the answer only ever concerns the handful of rows that are
-- series heads, not the whole invoice table.
CREATE INDEX IF NOT EXISTS "invoices_recurrence_due_idx"
  ON "invoices" ("recurrence_next_on")
  WHERE "recurrence" IS NOT NULL;

-- Reading a series back: "show me every invoice this one has produced".
CREATE INDEX IF NOT EXISTS "invoices_recurrence_source_idx"
  ON "invoices" ("recurrence_source_id")
  WHERE "recurrence_source_id" IS NOT NULL;

-- ---------------------------------------------------------- payment details

-- Bank details, so the invoice can say where the money goes. Held per tenant
-- because they are the same on every invoice the business raises.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bank_account_name" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bank_name" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bank_sort_code" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "bank_account_number" text;
-- Anything else the customer needs to know: "reference the invoice number",
-- "cheques payable to", "we take card on the day".
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "payment_instructions" text;
