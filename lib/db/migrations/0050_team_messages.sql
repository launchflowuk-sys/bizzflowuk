-- Messages between the people who work here.
--
-- The Messages page has only ever been an inbox for website enquiries. There
-- was nowhere for the two people actually running the business to say anything
-- to each other, so it happens in WhatsApp -- where it is not attached to the
-- job, not visible to whoever picks the work up next, and gone the moment
-- somebody clears a chat.
--
-- Deliberately small. This is not a chat product: it is a note to the person
-- covering tomorrow, pinned to the business rather than to a phone.
--
--   recipient_id NULL  -- everyone, the team channel
--   recipient_id set   -- just that person
--
-- read_at is per message rather than a separate receipts table because a
-- direct message has exactly one reader. Team messages carry no read state at
-- all, and pretending otherwise would mean a receipts table earning its keep
-- only for a feature nobody asked for.
--
-- Keep this file ASCII.

CREATE TABLE IF NOT EXISTS "team_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  -- NULL means the whole team.
  "recipient_id" integer,
  "body" text NOT NULL,
  -- Optional: the job this is about, so a note has a place to belong.
  "project_id" integer,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_messages_tenant_id_fk') THEN
    ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_tenant_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_messages_sender_id_fk') THEN
    ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_sender_id_fk"
      FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
  -- Recipient clears rather than cascading: losing a leaver's messages would
  -- take the handover notes with them, which is the opposite of the point.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_messages_recipient_id_fk') THEN
    ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_recipient_id_fk"
      FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_messages_project_id_fk') THEN
    ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_project_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Every read is "this tenant's messages, newest first".
CREATE INDEX IF NOT EXISTS "team_messages_tenant_idx"
  ON "team_messages" ("tenant_id", "created_at" DESC);

-- And "anything unread addressed to me", which drives the badge.
CREATE INDEX IF NOT EXISTS "team_messages_unread_idx"
  ON "team_messages" ("recipient_id")
  WHERE "read_at" IS NULL AND "recipient_id" IS NOT NULL;
