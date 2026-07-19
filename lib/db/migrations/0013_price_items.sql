CREATE TABLE IF NOT EXISTS "price_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'each' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fixed" boolean DEFAULT false NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_items" ADD CONSTRAINT "price_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_items_tenant_id_idx" ON "price_items" ("tenant_id");
