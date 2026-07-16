import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { servicesTable } from "./services";
import { areasTable } from "./areas";

export const faqsTable = pgTable("faqs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id),
  areaId: integer("area_id").references(() => areasTable.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  global: boolean("global").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("faqs_tenant_id_idx").on(table.tenantId),
  index("faqs_service_id_idx").on(table.serviceId),
  index("faqs_area_id_idx").on(table.areaId),
]);

export const insertFaqSchema = createInsertSchema(faqsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqsTable.$inferSelect;
