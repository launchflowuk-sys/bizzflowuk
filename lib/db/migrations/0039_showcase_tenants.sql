-- Real client sites on the BizzFlowUK homepage.
--
-- The marketing page shipped with a fictional business in its shop window while
-- four real ones were live on the platform. Which clients get featured, and in
-- what order, is an editorial decision - so it is data, not a hardcoded list in
-- a component that would be wrong the day a fifth tenant launches.
--
-- NULL means "not featured", which is the default and therefore the safe one:
-- onboarding a tenant never puts them on a public page by accident. A number
-- opts them in and sets their position.
--
-- Keep the copy in this file ASCII. An em-dash here came back through the
-- migration runner double-encoded ("a-euro-\""), because the file is read and
-- executed as a raw statement rather than sent as a parameter.
--
-- `showcase_blurb` is the one line shown under the site. It is separate from
-- the tenant's own hero copy on purpose: what a plumber says to a homeowner is
-- not what BizzFlowUK says about a plumber to another trade.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "showcase_order" integer;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "showcase_blurb" text;

-- Feature the live clients. Matched on slug so this is a no-op in any
-- environment where a given tenant does not exist - the local database has
-- three of the four, production has all of them.
UPDATE "tenants" SET "showcase_order" = 1,
  "showcase_blurb" = 'Rendering and external wall insulation across Essex and East London.'
  WHERE "slug" = 'amo-rendering' AND "showcase_order" IS NULL;

UPDATE "tenants" SET "showcase_order" = 2,
  "showcase_blurb" = 'Construction and groundworks, from extensions to full builds.'
  WHERE "slug" = 'amo-services' AND "showcase_order" IS NULL;

UPDATE "tenants" SET "showcase_order" = 3,
  "showcase_blurb" = 'Landscaping and groundworks: driveways, patios and full garden builds.'
  WHERE "slug" = 'kd-essex' AND "showcase_order" IS NULL;

UPDATE "tenants" SET "showcase_order" = 4,
  "showcase_blurb" = 'Plumbing, heating and Gas Safe certification for homes and landlords.'
  WHERE "slug" = 'bps' AND "showcase_order" IS NULL;

CREATE INDEX IF NOT EXISTS "tenants_showcase_order_idx" ON "tenants" ("showcase_order");
