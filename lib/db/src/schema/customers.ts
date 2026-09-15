import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  notes: text("notes"),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  clerkId: text("clerk_id"),
  /**
   * Sample data for a walkthrough, removable exactly (migration 0049).
   * Only the demo seeder ever sets this; every real row is false.
   */
  /**
   * This customer's id in the accounting package (migration 0052). Created
   * once and reused, or every invoice makes a duplicate contact in their
   * accounts.
   */
  accountingExternalId: text("accounting_external_id"),

  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("customers_tenant_id_idx").on(table.tenantId),
]);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
