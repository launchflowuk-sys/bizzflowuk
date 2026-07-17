-- Written idempotently, matching this repo's migration convention (see the
-- comment in scripts/run-migrations.mjs): safe to re-run without erroring.
CREATE TABLE IF NOT EXISTS "page_render_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"path" text NOT NULL,
	"html" text NOT NULL,
	"dehydrated_state" jsonb NOT NULL,
	"rendered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_render_cache_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "page_render_cache" ADD CONSTRAINT "page_render_cache_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "page_render_cache_tenant_path_idx" ON "page_render_cache" USING btree ("tenant_id","path");
