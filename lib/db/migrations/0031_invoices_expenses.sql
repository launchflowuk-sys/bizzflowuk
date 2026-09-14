-- Invoices, payments and expenses.
--
-- The spine for cash flow, the VAT threshold monitor, invoice chasing and the
-- revenue tiles. Additive only: no existing table is altered, so the three live
-- tenants are untouched by this migration.
--
-- status is text, never an enum — adding a status must never require
-- ALTER TYPE ... ADD VALUE inside drizzle's transaction batch.

CREATE TABLE IF NOT EXISTS invoices (
  id              serial PRIMARY KEY,
  tenant_id       integer NOT NULL REFERENCES tenants(id),
  customer_id     integer REFERENCES customers(id),
  quote_id        integer REFERENCES quotes(id),
  project_id      integer REFERENCES projects(id),

  reference       text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',

  issued_on       date,
  due_on          date,

  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate        numeric(5,2),
  vat_amount      numeric(10,2) NOT NULL DEFAULT 0,
  cis_deduction   numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid     numeric(10,2) NOT NULL DEFAULT 0,

  is_deposit      boolean NOT NULL DEFAULT false,

  notes           text,
  terms           text,

  sent_at         timestamptz,
  paid_at         timestamptz,
  voided_at       timestamptz,
  last_chased_at  timestamptz,
  chase_count     integer NOT NULL DEFAULT 0,

  pdf_path        text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id            serial PRIMARY KEY,
  invoice_id    integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description   text NOT NULL,
  quantity      numeric(10,2) NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL,
  vat_rate      numeric(5,2),
  total         numeric(10,2) NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id            serial PRIMARY KEY,
  invoice_id    integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount        numeric(10,2) NOT NULL,
  paid_on       date NOT NULL,
  method        text NOT NULL DEFAULT 'bank_transfer',
  reference     text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id                    serial PRIMARY KEY,
  tenant_id             integer NOT NULL REFERENCES tenants(id),
  project_id            integer REFERENCES projects(id),

  supplier              text NOT NULL,
  description           text,
  category              text NOT NULL DEFAULT 'materials',

  spent_on              date NOT NULL,
  net                   numeric(10,2) NOT NULL DEFAULT 0,
  vat_amount            numeric(10,2) NOT NULL DEFAULT 0,
  total                 numeric(10,2) NOT NULL DEFAULT 0,

  billable              boolean NOT NULL DEFAULT false,
  billed_on_invoice_id  integer REFERENCES invoices(id),

  receipt_path          text,
  notes                 text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx     ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx   ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_quote_id_idx      ON invoices (quote_id);
CREATE INDEX IF NOT EXISTS invoices_tenant_due_idx    ON invoices (tenant_id, due_on);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx    ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_id_idx ON invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS expenses_tenant_id_idx     ON expenses (tenant_id);
CREATE INDEX IF NOT EXISTS expenses_tenant_spent_idx  ON expenses (tenant_id, spent_on);
CREATE INDEX IF NOT EXISTS expenses_project_id_idx    ON expenses (project_id);

-- One reference per tenant. A duplicate invoice number is the sort of thing
-- only noticed during a dispute or a VAT inspection.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_reference_uniq
  ON invoices (tenant_id, reference);
