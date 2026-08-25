-- Pending invitations, so a login can be created without anyone handling a plaintext password.
--
-- Creating a user previously meant setting a password in a Coolify environment variable and
-- redeploying (see KD_ADMIN_PASSWORD / MARK_LOGIN_PASSWORD in the seeds). That put client
-- passwords in front of the operator and made onboarding require infrastructure access.
--
-- Only the SHA-256 hash of the token is stored: the raw value is shown to the inviting admin once
-- and never again, so this table leaking yields no usable invite links.
CREATE TABLE IF NOT EXISTS "user_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_invites_user_id_idx" ON "user_invites" ("user_id");
