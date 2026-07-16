import { pgTable, text, serial, timestamp, integer, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const visualiserStatusEnum = pgEnum("visualiser_status", ["pending", "reviewing", "completed"]);

export const visualiserRequestsTable = pgTable("visualiser_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  serviceInterest: text("service_interest"),
  colourPreference: text("colour_preference"),
  notes: text("notes"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  resultImageUrls: jsonb("result_image_urls").$type<string[]>().default([]),
  status: visualiserStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("visualiser_requests_tenant_id_idx").on(table.tenantId),
]);

export const insertVisualiserRequestSchema = createInsertSchema(visualiserRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisualiserRequest = z.infer<typeof insertVisualiserRequestSchema>;
export type VisualiserRequest = typeof visualiserRequestsTable.$inferSelect;
