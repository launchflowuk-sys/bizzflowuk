ALTER TABLE "payment_links" ALTER COLUMN "quote_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customer_email" text;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customer_phone" text;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "customer_address" text;
