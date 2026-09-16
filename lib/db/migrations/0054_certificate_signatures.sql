-- Signing a certificate on the tablet, on site.
--
-- The engine could already produce a legally shaped record and email it, but
-- the signature was a blank box on the PDF. On a gas safety record the
-- engineer's signature is one of the particulars the regulations require, so a
-- record without one is not finished -- it is a printout waiting for a pen.
--
-- Gas Safe accept electronic records and electronic signatures, so capturing
-- one on a phone is the intended use, not a workaround.
--
-- STORED AS A PATH, NOT AS BYTES. A signature PNG is ten to thirty kilobytes.
-- Inline in the row it bloats every SELECT that touches the table -- including
-- the certificate list, which reads every row a tenant owns -- for an image
-- nothing but the PDF renderer ever looks at. Same treatment as pdf_path:
-- written to the uploads volume under a per-tenant prefix, served only through
-- an authenticated route that checks ownership first.
--
-- signed_at is the moment the ENGINEER signed, which is not the moment the
-- record was issued: an engineer signs at the property and may well issue it
-- from the van an hour later, or the next morning.

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS engineer_signature_path text,
  ADD COLUMN IF NOT EXISTS customer_signature_path text,
  ADD COLUMN IF NOT EXISTS customer_signature_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone;
