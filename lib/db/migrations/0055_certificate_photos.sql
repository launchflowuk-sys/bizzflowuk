-- Photographs on a certificate.
--
-- The data plate, the flue termination, whatever was wrong. On a disputed job
-- a photograph taken at the time is the difference between the engineer's word
-- and evidence, and every engineer already takes them -- they just live in a
-- camera roll where nobody can find them a year later.
--
-- WHY A client_key ON THE APPLIANCE, which looks redundant next to its id:
--
--   Appliances are REPLACED WHOLESALE on every save. The route deletes the set
--   and inserts the new one, deliberately -- a partial merge on a safety
--   checklist is how a stale row survives into an issued record. That is the
--   right call and it is staying.
--
--   But it means appliance ids change on every save. Anything keyed to an
--   appliance id is orphaned the next time the engineer edits a field: the
--   photos would silently detach from the boiler they were taken of, which is
--   worse than not having them, because nobody would notice.
--
--   So the client mints a stable key per appliance and sends it back on every
--   save. Photos hang off that. The ids churn underneath and the photographs
--   stay attached to the right appliance.
--
-- A null appliance_key means a photo of the job rather than of one appliance.
--
-- The file lives on the uploads volume like the PDF and the signatures, served
-- only through a route that checks tenant ownership first.

ALTER TABLE certificate_appliances
  ADD COLUMN IF NOT EXISTS client_key text;

CREATE TABLE IF NOT EXISTS certificate_photos (
  id serial PRIMARY KEY,
  certificate_id integer NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  appliance_key text,
  path text NOT NULL,
  caption text,
  content_type text NOT NULL DEFAULT 'image/jpeg',
  byte_size integer,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certificate_photos_certificate_id_idx
  ON certificate_photos (certificate_id);
