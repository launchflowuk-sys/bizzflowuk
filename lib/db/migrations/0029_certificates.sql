-- Compliance certificates engine.
--
-- type and status are text, never an enum: adding a certificate type must never
-- need ALTER TYPE ... ADD VALUE, which cannot run inside a transaction on some
-- Postgres versions and aborts drizzle's whole migration batch.
--
-- Hand-written and idempotent throughout, per this repo's migration rules.

CREATE TABLE IF NOT EXISTS certificates (
  id                    serial PRIMARY KEY,
  tenant_id             integer NOT NULL REFERENCES tenants(id),

  type                  text NOT NULL,
  reference             text NOT NULL,
  status                text NOT NULL DEFAULT 'draft',

  customer_id           integer REFERENCES customers(id),
  project_id            integer REFERENCES projects(id),

  property_address      text NOT NULL,
  property_postcode     text,
  landlord_name         text,
  landlord_address      text,
  tenant_contact_name   text,
  tenant_contact_email  text,

  engineer_user_id      integer REFERENCES users(id),
  engineer_name         text,
  engineer_reg_no       text,

  checked_at            date NOT NULL,
  expires_at            date NOT NULL,

  outcome               text,
  data                  jsonb NOT NULL DEFAULT '{}'::jsonb,

  pdf_path              text,
  pdf_sha256            text,
  issued_at             timestamptz,
  superseded_by_id      integer,
  renewal_notified_at   timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Self-reference added separately so the table can be created in one statement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_superseded_by_id_fkey'
  ) THEN
    ALTER TABLE certificates
      ADD CONSTRAINT certificates_superseded_by_id_fkey
      FOREIGN KEY (superseded_by_id) REFERENCES certificates(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS certificate_appliances (
  id                     serial PRIMARY KEY,
  certificate_id         integer NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  position               integer NOT NULL DEFAULT 0,

  location               text NOT NULL,
  appliance_type         text,
  make                   text,
  model                  text,
  is_landlord_owned      boolean NOT NULL DEFAULT true,
  was_inspected          boolean NOT NULL DEFAULT true,

  -- Nullable on purpose: true / false / not applicable are three different
  -- answers, and "not tested" must never render as "failed".
  flue_flow_pass         boolean,
  safety_devices_pass    boolean,
  ventilation_pass       boolean,
  visual_condition_pass  boolean,
  gas_tightness_pass     boolean,
  combustion_reading     text,
  operating_pressure     text,

  defects                text,
  action_taken           text,
  safe_to_use            boolean,

  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certificates_tenant_id_idx ON certificates (tenant_id);
CREATE INDEX IF NOT EXISTS certificates_customer_idx  ON certificates (customer_id);

-- The renewal sweep runs against this every day; without it the query table-scans
-- every certificate ever issued across every tenant.
CREATE INDEX IF NOT EXISTS certificates_renewal_idx
  ON certificates (tenant_id, expires_at);

CREATE INDEX IF NOT EXISTS certificate_appliances_certificate_id_idx
  ON certificate_appliances (certificate_id);

-- One reference per tenant. A duplicate reference on a legal record is the kind
-- of thing only noticed during a dispute.
CREATE UNIQUE INDEX IF NOT EXISTS certificates_tenant_reference_uniq
  ON certificates (tenant_id, reference);
