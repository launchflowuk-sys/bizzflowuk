-- Automations engine.
--
-- Additive: new tables only. Everything is off by default, so no existing tenant
-- starts sending anything because this migration ran.

CREATE TABLE IF NOT EXISTS automations (
  id            serial PRIMARY KEY,
  tenant_id     integer NOT NULL REFERENCES tenants(id),
  key           text NOT NULL,
  enabled       boolean NOT NULL DEFAULT false,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at   timestamptz,
  actions_taken integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id           serial PRIMARY KEY,
  tenant_id    integer NOT NULL REFERENCES tenants(id),
  key          text NOT NULL,
  subject_type text,
  subject_id   integer,
  summary      text NOT NULL,
  outcome      text NOT NULL DEFAULT 'ok',
  detail       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_tenant_id_idx ON automations (tenant_id);
CREATE INDEX IF NOT EXISTS automation_runs_tenant_idx ON automation_runs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS automation_runs_subject_idx ON automation_runs (key, subject_type, subject_id);

-- One row per rule per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS automations_tenant_key_uniq ON automations (tenant_id, key);
