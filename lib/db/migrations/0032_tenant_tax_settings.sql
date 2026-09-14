-- Per-tenant VAT and CIS settings.
--
-- Off by default and nullable throughout: an invoice must never show VAT for a
-- business that has not told us it is registered. Existing tenants are
-- unaffected — every column is additive with a safe default.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS vat_number     text;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS vat_rate       numeric(5,2) DEFAULT 20;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS cis_registered boolean NOT NULL DEFAULT false;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS cis_utr        text;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS cis_rate       numeric(5,2) DEFAULT 20;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS invoice_terms  text;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS payment_days   integer NOT NULL DEFAULT 14;

-- Feature flags. New modules stay dark for existing tenants until switched on,
-- so nobody's dashboard changes under them.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
