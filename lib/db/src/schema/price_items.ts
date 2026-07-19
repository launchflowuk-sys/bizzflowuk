import { pgTable, text, serial, timestamp, integer, boolean, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

/**
 * Tenant-defined pricing that powers the public cost calculator. Platform-wide: every tenant
 * enters their own items, and the single shared calculator page reads whichever tenant it's on.
 * Deliberately generic (name + unit + unit price + optional category) so it fits rendering
 * (per m²), construction (per day / fixed), delivery/call-out charges, and anything else —
 * without a per-industry schema. Money as numeric(10,2) strings, same as quotes.
 */
export const priceItemsTable = pgTable("price_items", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  category: text("category"),                    // grouping header, e.g. "Rendering", "Extras", "Delivery"
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull().default("each"),  // "m²", "each", "day", "hour", "linear m", "fixed"
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  // "fixed" items are a one-off add-on (checkbox), not multiplied by a quantity the user types.
  fixed: boolean("fixed").notNull().default(false),
  minQuantity: integer("min_quantity").notNull().default(0),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("price_items_tenant_id_idx").on(table.tenantId),
]);

export const insertPriceItemSchema = createInsertSchema(priceItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPriceItem = z.infer<typeof insertPriceItemSchema>;
export type PriceItem = typeof priceItemsTable.$inferSelect;
