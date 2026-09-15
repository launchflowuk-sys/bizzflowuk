import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";

/**
 * A property: the thing certificates, jobs and a landlord all hang off.
 *
 * Certificates carry a free-text `propertyAddress`, which is fine for a one-off
 * and falls apart for a landlord with eleven flats — the same address gets typed
 * eleven slightly different ways, so "everything for 42 Maple Avenue" cannot be
 * answered and flat 3's renewal looks like a different building to flat 4's.
 *
 * Nothing is migrated automatically. Guessing that two similar strings are the
 * same building is the exact mistake this table exists to prevent.
 */
export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  /** A landlord with a portfolio is one customer with many properties. */
  customerId: integer("customer_id").references(() => customersTable.id),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  /** "Flat 3", "Rear annexe" — what tells two records at one postcode apart. */
  unit: text("unit"),
  propertyType: text("property_type"),
  notes: text("notes"),
  /** Who to ring to get in. Often neither the landlord nor the paying customer. */
  accessNotes: text("access_notes"),
  tenantName: text("tenant_name"),
  tenantPhone: text("tenant_phone"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("properties_tenant_id_idx").on(table.tenantId),
  index("properties_customer_id_idx").on(table.customerId),
  index("properties_postcode_idx").on(table.tenantId, table.postcode),
]);

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;

/** One line, the way it would be written on an envelope. */
export function formatPropertyAddress(p: {
  unit?: string | null; addressLine1: string; addressLine2?: string | null;
  city?: string | null; postcode?: string | null;
}): string {
  return [p.unit, p.addressLine1, p.addressLine2, p.city, p.postcode]
    .map(part => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}
