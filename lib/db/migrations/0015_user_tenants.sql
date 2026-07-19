CREATE TABLE IF NOT EXISTS "user_tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"role" "user_role" DEFAULT 'TENANT_ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenants_user_tenant_uq" ON "user_tenants" ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tenants_user_id_idx" ON "user_tenants" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tenants_tenant_id_idx" ON "user_tenants" ("tenant_id");--> statement-breakpoint
INSERT INTO "user_tenants" ("user_id", "tenant_id", "role")
SELECT "id", "tenant_id", "role" FROM "users" WHERE "tenant_id" IS NOT NULL
ON CONFLICT ("user_id","tenant_id") DO NOTHING;
