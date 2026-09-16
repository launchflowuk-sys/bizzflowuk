-- A way back into an account after forgetting the password.
--
-- There was none. Not a broken one -- none at all. A trade who forgot their
-- password had to contact us, and the only fix was reaching into the database
-- by hand, which means the operator picks a password for somebody else and
-- then has to tell them what it is over WhatsApp. For a platform selling
-- itself to independent businesses that is both an embarrassment and a
-- support burden that lands on one person.
--
-- This is deliberately the same shape as user_invites, because it is the same
-- job with a different trigger: prove you can read an inbox, then set your own
-- password. Only a SHA-256 hash of the token is stored, so a leaked database
-- hands an attacker nothing usable; the raw token exists only in the email.
-- Single use and short-lived, because unlike an invitation this can be
-- requested by anyone who knows an email address.

CREATE TABLE IF NOT EXISTS password_resets (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  requested_ip text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);
