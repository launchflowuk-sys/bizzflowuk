-- A job a customer can look at without an account.
--
-- There is already a customer portal, and it is behind a login. That is right
-- for a customer who has an account and wrong for almost everybody else: the
-- person who wants to know what time you are coming on Thursday is not going
-- to make an account to find out, and a trade is not going to talk them
-- through a password reset from the top of a ladder.
--
-- So a job gets an optional share token. Whoever holds the link sees THAT job
-- and nothing else -- when it is booked, who is coming, what was quoted for,
-- what the reference is. It is the same shape as the payment link that already
-- exists: a long random token IS the credential, it can be turned off, and it
-- reaches exactly one record.
--
-- Nullable, because the overwhelming majority of jobs will never be shared and
-- minting a token for every one of them would be generating credentials nobody
-- asked for.
--
-- Keep this file ASCII.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "share_token" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "share_created_at" timestamptz;
-- Revoking sets this rather than clearing the token, so the same link is never
-- handed out twice and a scan of an old printed job sheet fails closed rather
-- than landing on somebody else's job.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "share_revoked_at" timestamptz;

-- Unique so a token can never address two jobs, PARTIAL so the overwhelming
-- majority of rows -- which have no token -- do not all collide on NULL.
--
-- Note for anyone writing an upsert against this later: Postgres will not
-- infer a partial unique index for ON CONFLICT unless the statement repeats
-- the WHERE predicate. That exact trap silently broke the Google review sync
-- for months.
CREATE UNIQUE INDEX IF NOT EXISTS "projects_share_token_key"
  ON "projects" ("share_token")
  WHERE "share_token" IS NOT NULL;
