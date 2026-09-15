-- Properties as a first-class thing.
--
-- Certificates already carry a property_address as free text. That works for a
-- one-off, and falls apart for a landlord with eleven flats: the same address
-- gets typed eleven slightly different ways, so "show me everything for 42
-- Maple Avenue" cannot be answered and the renewal for flat 3 looks like a
-- different building to the renewal for flat 4.
--
-- A property is the thing certificates, jobs and a landlord all hang off. Give
-- it an identity once and the portfolio view falls out for free.
--
-- Additive and nullable throughout: existing certificates keep their free-text
-- address and simply have no property linked until someone links one. Nothing
-- is migrated automatically, because guessing that two similar strings are the
-- same building is exactly the mistake this table exists to stop.
--
-- Keep this file ASCII.

CREATE TABLE IF NOT EXISTS "properties" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  -- The customer who owns or manages it. A landlord with a portfolio is one
  -- customer with many properties.
  "customer_id" integer REFERENCES "customers"("id"),
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" text,
  "postcode" text,
  -- "Flat 3", "Rear annexe" -- what distinguishes two records at one postcode.
  "unit" text,
  "property_type" text,
  "notes" text,
  -- Who to ring to get in. Often not the landlord and often not the customer.
  "access_notes" text,
  "tenant_name" text,
  "tenant_phone" text,
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "properties_tenant_id_idx" ON "properties" ("tenant_id");
CREATE INDEX IF NOT EXISTS "properties_customer_id_idx" ON "properties" ("customer_id");
CREATE INDEX IF NOT EXISTS "properties_postcode_idx" ON "properties" ("tenant_id", "postcode");

-- Link a certificate to a property when one is known. Nullable, so every
-- existing certificate is untouched and still valid.
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "property_id" integer REFERENCES "properties"("id");
CREATE INDEX IF NOT EXISTS "certificates_property_id_idx" ON "certificates" ("property_id");

-- Marks a record brought in from a previous system or a paper file rather than
-- issued here. It matters: an imported certificate was not produced by this
-- engine, so its PDF is whatever was uploaded and its contents were not
-- validated by us. Renewals still work from the expiry date either way.
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "imported" boolean NOT NULL DEFAULT false;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "imported_note" text;
