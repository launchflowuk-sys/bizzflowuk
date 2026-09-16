-- The badge that floats on the hero photograph.
--
-- On a heating site the strongest single line is usually the warranty on a new
-- boiler -- "10-year warranty" does more work than any adjective. It is also a
-- CLAIM, and claims that carry weight stay tenant-owned rather than being
-- hardcoded into a shared template: the guarantee depends on the brand fitted
-- and on the installer's accreditation, so only the business can say it.
--
-- Empty means no badge. A template that invents one would be putting words in
-- an engineer's mouth about a commitment he has to honour.

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS hero_badge text;
