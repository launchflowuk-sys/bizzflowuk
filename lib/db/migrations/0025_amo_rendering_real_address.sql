-- AMO Rendering's real trading address.
--
-- The site was publishing "11 Whitchurch Parade, Whitchurch Lane, Edgware, Middlesex, HA8 6LR" in
-- the footer and in the PostalAddress schema, while every headline said Grays. That is a North
-- London address on a business whose verified Google Business Profile shows it serving Thurrock —
-- a NAP mismatch against their own listing, and to a customer it reads as a Grays firm that is
-- actually based thirty miles away. Confirmed by Shoji: the trading address is 324 Long Lane.
--
-- city also held "Grays Thurrock Essex", a keyword string rather than a town. It feeds
-- addressLocality in the LocalBusiness JSON-LD, which Google reads, so it is now the actual town.
-- The marketing wording lives in service_base / service_area (migration 0023) and is unchanged.
UPDATE "tenant_settings" s
SET "address" = '324 Long Lane, Grays, RM16 2QH',
    "city" = 'Grays'
FROM "tenants" t
WHERE s."tenant_id" = t."id" AND t."name" ILIKE '%AMO Rendering%';--> statement-breakpoint

UPDATE "tenants"
SET "address" = '324 Long Lane, Grays, RM16 2QH',
    "city" = 'Grays'
WHERE "name" ILIKE '%AMO Rendering%';
