ALTER TABLE "sent_emails" ADD COLUMN IF NOT EXISTS "attachment_urls" jsonb DEFAULT '[]'::jsonb;
