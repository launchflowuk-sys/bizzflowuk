-- Automated notifications (new lead, quote sent, quote accepted, receipts) wrote nothing to
-- sent_emails, so the dashboard could only ever show hand-composed messages. A tenant therefore
-- had no way to tell a delivered quote from one SMTP silently dropped — sendEmail no-ops when
-- unconfigured and fireNotification swallows its errors, so the UI reported success either way.
--
-- `event` records which notification produced a row; NULL means composed by hand in the
-- dashboard, which is what every existing row is.

ALTER TABLE "sent_emails" ADD COLUMN IF NOT EXISTS "event" text;

-- Automated sends have no dashboard user behind them, and a failed send has no rendered body.
ALTER TABLE "sent_emails" ALTER COLUMN "body_html" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "sent_emails_event_idx" ON "sent_emails" ("event");
CREATE INDEX IF NOT EXISTS "sent_emails_created_at_idx" ON "sent_emails" ("created_at" DESC);
