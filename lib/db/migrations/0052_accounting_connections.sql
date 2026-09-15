-- Sending invoices to the tenant's accounting package.
--
-- Brandon on why he uses his current app: "it links to Xero my accounting
-- software." That is the one thing on his list we had nothing for, and it is
-- not a small thing -- a trade who has to retype every invoice into Xero at
-- the weekend will keep using whatever already does it for them.
--
-- WHY A TABLE AND NOT MORE COLUMNS ON tenant_settings, which is where the
-- Stripe, Square, SMTP and Twilio credentials live:
--
--   Those are static secrets. A tenant pastes a key and it works until they
--   change it. OAuth is not that. An access token expires in minutes, a
--   refresh token has to be stored and rotated, the provider hands back its
--   own organisation id, and a connection can go stale and need re-consent
--   without anybody touching our settings page. That is a lifecycle, and a
--   lifecycle wants a row of its own with room to record its state.
--
--   It is also many-per-tenant by nature. A business might link Xero today
--   and FreeAgent next year, and a shape that assumes one forces a migration
--   the moment that happens.
--
-- ONE CONNECTION PER PROVIDER PER TENANT, enforced by a unique index rather
-- than by the code remembering to check. Two live connections to the same
-- package would mean every invoice pushed twice, which is a mess in somebody's
-- accounts and exactly the kind of thing nobody notices until VAT is due.
--
-- Keep this file ASCII.

CREATE TABLE IF NOT EXISTS "accounting_connections" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  -- Registry key: 'xero', 'freeagent', and whatever is added later.
  "provider" text NOT NULL,

  -- connected | needs_reauth | disconnected
  --
  -- needs_reauth is its own state on purpose. A refresh that fails is not the
  -- same as never having connected, and the difference is what the tenant
  -- needs to be told: "press reconnect" rather than "set this up".
  "status" text NOT NULL DEFAULT 'connected',

  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamptz,

  -- The provider's own id for the business, which most of them require on
  -- every subsequent call. Xero calls it a tenant id, QuickBooks a realm id.
  "organisation_id" text,
  "organisation_name" text,

  -- Per-provider choices: which sales account code to post to, whether to
  -- push drafts, and so on. Shapeless here, validated by the provider.
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,

  "connected_by_user_id" integer,
  "connected_at" timestamptz DEFAULT now() NOT NULL,
  "last_sync_at" timestamptz,
  -- The last thing that went wrong, kept so a failing link explains itself on
  -- screen instead of just quietly doing nothing.
  "last_error" text,
  "last_error_at" timestamptz,

  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_connections_tenant_id_fk') THEN
    ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_tenant_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
  END IF;
  -- The person who connected it is useful for support and is not load-bearing,
  -- so losing them to a staff change must not take the connection with it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_connections_user_fk') THEN
    ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_user_fk"
      FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_connections_status_check') THEN
    ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_status_check"
      CHECK ("status" IN ('connected', 'needs_reauth', 'disconnected'));
  END IF;
END $$;

-- One live link per package per business. See the note above about double
-- posting.
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_connections_tenant_provider_key"
  ON "accounting_connections" ("tenant_id", "provider");

-- --------------------------------------------------------------- invoices

-- Which invoice has already been pushed, and what it became at the other end.
--
-- This is the idempotency latch, and it is on the invoice rather than in a log
-- table for the same reason the review sync keys on external_id: the question
-- asked before every push is "has THIS invoice already gone", and that should
-- be answerable from the row in hand.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "accounting_provider" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "accounting_external_id" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "accounting_synced_at" timestamptz;
-- Kept so a push that failed says why on the invoice itself, rather than the
-- trade discovering at the year end that eleven invoices never arrived.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "accounting_error" text;

-- The sweep asks: which sent invoices have not reached the accounts yet?
CREATE INDEX IF NOT EXISTS "invoices_accounting_pending_idx"
  ON "invoices" ("tenant_id")
  WHERE "accounting_synced_at" IS NULL;

-- Customers get the same treatment: a contact is created once at the provider
-- and reused, or every invoice creates a duplicate customer in their accounts.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "accounting_external_id" text;
