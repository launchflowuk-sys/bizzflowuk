-- Sample data that can be removed exactly, and never removes anything else.
--
-- Walking a client through an empty dashboard sells nothing: every list says
-- "no invoices yet", every chart is flat, and the person you are showing it to
-- has to imagine the product. So a tenant can be filled with believable sample
-- data for a demo and emptied again afterwards.
--
-- The hard part is the "afterwards". BPS is a LIVE business with real
-- customers and 33 real reviews, so "delete everything for this tenant" is not
-- an option, and neither is matching on a marker typed into a notes field --
-- that shows up on screen during the very demo it exists for, and it deletes
-- anything a real user happens to type the same words into.
--
-- So each row carries a flag. Removal is `where tenant_id = X and is_demo`,
-- which cannot touch a real row even in principle, and nothing about it is
-- visible on any screen.
--
-- DEFAULT FALSE everywhere: every row that already exists, and every row any
-- normal code path writes from now on, is real. Only the seeder sets this.
--
-- Keep this file ASCII.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "is_demo" boolean NOT NULL DEFAULT false;

-- Partial indexes: the only question ever asked of this column is "which rows
-- are demo rows for this tenant", and the answer is a handful out of many.
CREATE INDEX IF NOT EXISTS "customers_demo_idx" ON "customers" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "leads_demo_idx" ON "leads" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "quotes_demo_idx" ON "quotes" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "projects_demo_idx" ON "projects" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "invoices_demo_idx" ON "invoices" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "expenses_demo_idx" ON "expenses" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "certificates_demo_idx" ON "certificates" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "properties_demo_idx" ON "properties" ("tenant_id") WHERE "is_demo";
CREATE INDEX IF NOT EXISTS "contact_messages_demo_idx" ON "contact_messages" ("tenant_id") WHERE "is_demo";
