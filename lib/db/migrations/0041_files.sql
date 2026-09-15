-- The Files module: the paperwork a trade has to be able to produce on a phone.
--
-- Public liability certificate, Gas Safe card, COSHH sheets, risk assessments,
-- method statements, blank forms. Today these live in someone's email or a van
-- glovebox, and the moment they are needed is on site, in front of a customer
-- or an inspector, with one bar of signal.
--
-- The bytes go through the storage service that already exists and is already
-- tenant-scoped; this table is the index over them. `object_path` is the
-- private path, never a public URL: reaching a file always goes through the
-- signed-token route, so a link cannot be forwarded to someone outside the
-- business and keep working forever.
--
-- Keep this file ASCII.

CREATE TABLE IF NOT EXISTS "files" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  -- insurance | gas_safe | coshh | risk_assessment | method_statement |
  -- template | other. Text rather than an enum: adding a category should be a
  -- one-line change, and ALTER TYPE ... ADD VALUE cannot run in a transaction.
  "category" text NOT NULL DEFAULT 'other',
  "object_path" text NOT NULL,
  "content_type" text,
  "size_bytes" integer,
  "notes" text,
  -- Expiry matters for exactly the documents people forget: insurance renews
  -- annually, a Gas Safe card expires. NULL means "does not expire".
  "expires_at" timestamptz,
  -- Pinned documents surface first, because the two or three you reach for on
  -- site should not be found by scrolling.
  "pinned" boolean NOT NULL DEFAULT false,
  "uploaded_by_user_id" integer REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "files_tenant_id_idx" ON "files" ("tenant_id");
CREATE INDEX IF NOT EXISTS "files_tenant_category_idx" ON "files" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "files_expires_at_idx" ON "files" ("expires_at");
