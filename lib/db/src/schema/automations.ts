import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * Automations — one engine, a catalogue of rules.
 *
 * A rule is data plus a handler in the registry, never a branch on tenant. Same
 * pattern as the certificate type registry: adding an automation is an entry in
 * a file, not a project.
 *
 * Everything is off by default and stays off until a tenant has been through the
 * rule's setup questions. Nothing goes out under a business's name before they
 * have seen the wording.
 */
export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  /** Registry key, e.g. 'chase_unpaid_invoices'. */
  key: text("key").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  /** Rule-specific settings, validated by that rule's zod schema. */
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  /** Running total of things this rule has actually done for the tenant. */
  actionsTaken: integer("actions_taken").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("automations_tenant_id_idx").on(table.tenantId),
]);

/**
 * Every action an automation takes, one row each.
 *
 * Two jobs: it is the idempotency latch (a rule checks whether it has already
 * acted on this subject) and it is the evidence for "BizzFlow did N things for
 * you this month" — a claim that should be countable, not estimated.
 */
export const automationRunsTable = pgTable("automation_runs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  key: text("key").notNull(),
  /** What it acted on, e.g. 'invoice' + id, so a rule cannot act twice. */
  subjectType: text("subject_type"),
  subjectId: integer("subject_id"),
  /** A short human line shown in the activity list. */
  summary: text("summary").notNull(),
  /** ok | skipped | failed */
  outcome: text("outcome").notNull().default("ok"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("automation_runs_tenant_idx").on(table.tenantId, table.createdAt),
  index("automation_runs_subject_idx").on(table.key, table.subjectType, table.subjectId),
]);

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Automation = typeof automationsTable.$inferSelect;
export type AutomationRun = typeof automationRunsTable.$inferSelect;
