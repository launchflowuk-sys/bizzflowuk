-- Jobs created by hand, not only jobs that arrived through the website.
--
-- The platform was built lead-first: an enquiry comes from the website, becomes
-- a quote, and the accepted quote becomes a job. That is one real path and it
-- works. It is not the path most trades are on.
--
-- Brandon gets a phone call at seven in the morning. There is no lead, no
-- website visit and no quote -- there is a customer who may not exist yet and a
-- job that needs to be in the diary before he puts the kettle on. Creating that
-- by hand needed a form with three fields (title, city, description), which is
-- not a job, it is a note.
--
-- Two things are missing from the table to make a real one:
--
--   service_id    Which of the tenant's services this is. The job already
--                 carries a free-text title; naming the service links it to
--                 what they actually sell, which is what makes reporting and
--                 the repeat-work automation possible later.
--
--   project_items The estimated work. Modelled on quote_items deliberately --
--                 same shape, same precision -- so a job priced up on the
--                 doorstep can become a quote or an invoice later without
--                 anything being retyped or rounded differently.
--
-- Why estimated work sits on the JOB and not only on a quote: a trade pricing a
-- callout on the doorstep is not writing a quote, they are writing down what
-- they are going to do and roughly what it costs. Forcing that through a quote
-- first is our data model leaking into their morning.
--
-- Keep this file ASCII.

-- Which service this job is. Nullable: plenty of jobs are one-offs that do not
-- map to anything on the price list, and refusing to save one because of that
-- would be worse than leaving it blank.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "service_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_service_id_services_id_fk'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_service_id_services_id_fk"
      FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- The estimated work lines. Same columns and the same numeric precision as
-- quote_items, so a total calculated here and a total calculated there can
-- never disagree by a penny.
CREATE TABLE IF NOT EXISTS "project_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- ON DELETE CASCADE: an item has no meaning without its job, and orphans here
-- would quietly inflate every total that counts them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_items_project_id_projects_id_fk'
  ) THEN
    ALTER TABLE "project_items"
      ADD CONSTRAINT "project_items_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- Every read of these is "the lines for this job, in order".
CREATE INDEX IF NOT EXISTS "project_items_project_idx"
  ON "project_items" ("project_id", "sort_order");
