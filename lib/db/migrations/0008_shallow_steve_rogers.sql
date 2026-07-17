-- Written idempotently, matching this repo's migration convention (see the
-- comment in scripts/run-migrations.mjs): safe to re-run without erroring.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sent_email_status') THEN
    CREATE TYPE "public"."sent_email_status" AS ENUM('sent', 'failed');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"sent_by_user_id" integer,
	"lead_id" integer,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"status" "sent_email_status" DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sent_emails_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sent_emails_sent_by_user_id_users_id_fk') THEN
    ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sent_emails_lead_id_leads_id_fk') THEN
    ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_emails_tenant_id_idx" ON "sent_emails" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_emails_lead_id_idx" ON "sent_emails" USING btree ("lead_id");
