import { pgTable, text, serial, timestamp, integer, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";

export const contactMessagesTable = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  source: text("source").default("contact_form"),
  /**
   * Sample data for a walkthrough, removable exactly (migration 0049).
   * Only the demo seeder ever sets this; every real row is false.
   */
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("contact_messages_tenant_id_idx").on(table.tenantId),
  index("contact_messages_customer_id_idx").on(table.customerId),
]);

export const portalMessagesTable = pgTable("portal_messages", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  senderRole: text("sender_role").notNull().default("customer"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("portal_messages_tenant_id_idx").on(table.tenantId),
  index("portal_messages_customer_id_idx").on(table.customerId),
]);

export const insertContactMessageSchema = createInsertSchema(contactMessagesTable).omit({ id: true, createdAt: true });
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessagesTable.$inferSelect;

export const insertPortalMessageSchema = createInsertSchema(portalMessagesTable).omit({ id: true, createdAt: true });
export type InsertPortalMessage = z.infer<typeof insertPortalMessageSchema>;
export type PortalMessage = typeof portalMessagesTable.$inferSelect;
