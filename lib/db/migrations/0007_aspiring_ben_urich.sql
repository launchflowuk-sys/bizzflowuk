ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
