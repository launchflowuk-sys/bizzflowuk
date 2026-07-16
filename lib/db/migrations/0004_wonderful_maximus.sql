-- Written idempotently, matching this repo's migration convention (see the
-- comment in scripts/run-migrations.mjs): safe to re-run without erroring.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_link_status') THEN
    CREATE TYPE "public"."payment_link_status" AS ENUM('Pending', 'Paid', 'Failed', 'Expired', 'Cancelled');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"quote_id" integer NOT NULL,
	"token" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"status" "payment_link_status" DEFAULT 'Pending' NOT NULL,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"idempotency_key" text NOT NULL,
	"square_payment_id" text,
	"failure_reason" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "square_application_id" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "square_location_id" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "square_access_token" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "square_environment" text DEFAULT 'sandbox';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_payment_received_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_payment_received_sms" boolean DEFAULT true;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_links_quote_id_quotes_id_fk') THEN
    ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_tenant_id_idx" ON "payment_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_quote_id_idx" ON "payment_links" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_token_idx" ON "payment_links" USING btree ("token");
