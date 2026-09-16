-- The Gas Safe registration, as a badge a visitor can check.
--
-- "Gas Safe registered" already appears as one of four small items in the trust
-- strip, which is where the single strongest trust signal a heating business
-- has goes to be ignored. A homeowner letting a stranger near their gas supply
-- is told to check the register -- so the number goes on the page, prominently,
-- with a link to go and check it.
--
-- TWO COLUMNS, and the second one matters. gas_safe_url is separate because the
-- register's own deep-link format could not be verified: gassaferegister.co.uk
-- returns 403 to any automated request, so guessing a path would risk a trust
-- badge that leads to a 404 -- worse than no link at all. The business pastes
-- the URL they can see in their own browser; the default is the register's
-- front page, which always works.
--
-- Empty number means no badge. A template must never assert that a business is
-- Gas Safe registered -- that claim is the tenant's alone to make, and it is
-- the one claim on the whole site that is a criminal matter to fake.

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS gas_safe_number text,
  ADD COLUMN IF NOT EXISTS gas_safe_url text;
