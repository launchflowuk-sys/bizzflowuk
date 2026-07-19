import { pgTable, serial, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable, userRoleEnum } from "./users";
import { tenantsTable } from "./tenants";

/**
 * Which businesses a single user can access. A user with more than one row here is a
 * multi-business operator (e.g. Mark, who runs both AMO Rendering and AMO Services) and gets
 * a business switcher in the dashboard. Single-business users have exactly one row and see no
 * switcher — behaviour is unchanged for them.
 *
 * The user's *currently active* business is `users.tenantId` (read live by the auth middleware
 * on every request, so all data scoping follows it). Switching business = update users.tenantId
 * to another tenant this table says the user belongs to. `role` is per-membership so the same
 * person can be e.g. TENANT_ADMIN of one business and STAFF of another.
 */
export const userTenantsTable = pgTable("user_tenants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull().default("TENANT_ADMIN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_tenants_user_tenant_uq").on(table.userId, table.tenantId),
  index("user_tenants_user_id_idx").on(table.userId),
  index("user_tenants_tenant_id_idx").on(table.tenantId),
]);

export const insertUserTenantSchema = createInsertSchema(userTenantsTable).omit({ id: true, createdAt: true });
export type InsertUserTenant = z.infer<typeof insertUserTenantSchema>;
export type UserTenant = typeof userTenantsTable.$inferSelect;
