-- This migration is written idempotently on purpose: migrations 0001/0002 ran
-- against production without corresponding snapshot files (the local snapshot
-- chain only went up to 0000), so drizzle-kit's diff against the stale 0000
-- baseline re-emits some columns/constraints that may already exist in prod.
-- IF NOT EXISTS / DO-block guards make this migration safe to run regardless
-- of exactly which of 0001/0002's changes are already applied there.
ALTER TABLE "users" ALTER COLUMN "clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_new_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_new_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_survey_booked_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_survey_booked_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_sent_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_sent_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_accepted_email" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_quote_accepted_sms" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_won_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_lead_won_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_in_progress_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_in_progress_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_complete_email" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "notify_project_complete_sms" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_delay_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_channel" text DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_request_template" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "review_platform_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_type" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "existing_surface" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "desired_finish" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "timeframe" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "photo_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "review_request_sent_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_notes_lead_id_idx" ON "lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_notes_author_id_idx" ON "lead_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_id_idx" ON "leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_assigned_to_id_idx" ON "leads" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_items_quote_id_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_tenant_id_idx" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_lead_id_idx" ON "quotes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_updates_project_id_idx" ON "project_updates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_customer_id_idx" ON "projects" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_quote_id_idx" ON "projects" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_tenant_id_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "areas_tenant_id_idx" ON "areas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "before_after_tenant_id_idx" ON "before_after" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "before_after_service_id_idx" ON "before_after" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gallery_images_tenant_id_idx" ON "gallery_images" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gallery_images_service_id_idx" ON "gallery_images" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gallery_images_area_id_idx" ON "gallery_images" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_tenant_id_idx" ON "reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_service_id_idx" ON "reviews" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_studies_tenant_id_idx" ON "case_studies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_studies_service_id_idx" ON "case_studies" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faqs_tenant_id_idx" ON "faqs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faqs_service_id_idx" ON "faqs" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faqs_area_id_idx" ON "faqs" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_categories_tenant_id_idx" ON "blog_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_id_idx" ON "blog_posts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_posts_category_id_idx" ON "blog_posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visualiser_requests_tenant_id_idx" ON "visualiser_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_tenant_id_idx" ON "contact_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_messages_customer_id_idx" ON "contact_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_messages_tenant_id_idx" ON "portal_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_messages_customer_id_idx" ON "portal_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_tenant_id_idx" ON "team_members" USING btree ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
