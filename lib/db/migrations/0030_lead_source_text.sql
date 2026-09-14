-- lead_source becomes text.
--
-- Certificate renewals need a "Renewal" source, and more sources will follow as
-- the platform grows. Adding a value to a pg enum needs ALTER TYPE ... ADD VALUE,
-- which cannot run inside a transaction on some Postgres versions and aborts
-- drizzle's whole migration batch — this repo has been bitten by that before.
--
-- Converting the column to text removes the constraint permanently, so no future
-- source ever needs a migration. Existing values are preserved exactly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'source' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE leads ALTER COLUMN source DROP DEFAULT;
    ALTER TABLE leads ALTER COLUMN source TYPE text USING source::text;
    ALTER TABLE leads ALTER COLUMN source SET DEFAULT 'Website';
  END IF;
END $$;
