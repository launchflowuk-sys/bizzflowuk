import { pgTable, text, serial, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

/**
 * A tenant's link to their accounting package (migration 0052).
 *
 * Separate from tenant_settings, where the Stripe/Square/SMTP credentials
 * live, because OAuth is a lifecycle rather than a pasted key: the access
 * token expires in minutes, the refresh token rotates, the provider hands back
 * its own organisation id, and a link can go stale without anyone touching our
 * settings page. That wants a row with room to record its state.
 */
export const accountingConnectionsTable = pgTable("accounting_connections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  /** Registry key: 'xero', 'freeagent', and whatever is added later. */
  provider: text("provider").notNull(),

  /**
   * connected | needs_reauth | disconnected
   *
   * `needs_reauth` is its own state deliberately: a refresh that failed is not
   * the same as never having set it up, and the difference is exactly what the
   * tenant needs to be told.
   */
  status: text("status").notNull().default("connected"),

  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  /** The provider's own id for the business. Xero: tenantId. QuickBooks: realmId. */
  organisationId: text("organisation_id"),
  organisationName: text("organisation_name"),

  /** Per-provider choices, validated by that provider rather than here. */
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),

  connectedByUserId: integer("connected_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  /** Kept so a failing link explains itself on screen instead of going quiet. */
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  // One live link per package per business. Two would mean every invoice
  // pushed twice, which nobody notices until VAT is due.
  uniqueIndex("accounting_connections_tenant_provider_key").on(table.tenantId, table.provider),
]);

export type AccountingConnection = typeof accountingConnectionsTable.$inferSelect;
