-- Dispatch: assign a job to a person.
--
-- Points at users, not at the team table. `team` is the public "meet the team"
-- content for the website — bios, photos, sort order — and is not staff you can
-- give work to. Conflating the two would put a marketing row in an operational
-- foreign key.
--
-- Additive and nullable: every existing project stays unassigned and nothing
-- changes for the three live tenants.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_user_id integer REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS colour text;

-- The calendar queries a tenant's window of time, every time it moves a month.
CREATE INDEX IF NOT EXISTS projects_tenant_scheduled_idx
  ON projects (tenant_id, scheduled_start);
CREATE INDEX IF NOT EXISTS projects_assigned_idx
  ON projects (assigned_user_id);

-- A private, revocable token per user for the read-only calendar feed. Kept off
-- the users table so revoking a feed never touches the login record.
CREATE TABLE IF NOT EXISTS calendar_feeds (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants(id),
  user_id     integer NOT NULL REFERENCES users(id),
  token       text NOT NULL,
  label       text,
  revoked_at  timestamptz,
  last_read_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feeds_token_uniq ON calendar_feeds (token);
CREATE INDEX IF NOT EXISTS calendar_feeds_user_idx ON calendar_feeds (user_id);
