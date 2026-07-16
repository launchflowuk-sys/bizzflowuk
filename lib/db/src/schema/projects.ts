import { pgTable, text, serial, timestamp, integer, pgEnum, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { quotesTable } from "./quotes";

export const projectStatusEnum = pgEnum("project_status", ["Enquiry", "Survey Booked", "Quote Approved", "Scheduled", "In Progress", "Completed"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  quoteId: integer("quote_id").references(() => quotesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("Enquiry"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  warrantyInfo: text("warranty_info"),
  reviewRequestSentAt: timestamp("review_request_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("projects_tenant_id_idx").on(table.tenantId),
  index("projects_customer_id_idx").on(table.customerId),
  index("projects_quote_id_idx").on(table.quoteId),
]);

export const projectUpdatesTable = pgTable("project_updates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  visibleToCustomer: boolean("visible_to_customer").notNull().default(true),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("project_updates_project_id_idx").on(table.projectId),
]);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const insertProjectUpdateSchema = createInsertSchema(projectUpdatesTable).omit({ id: true, createdAt: true });
export type InsertProjectUpdate = z.infer<typeof insertProjectUpdateSchema>;
export type ProjectUpdate = typeof projectUpdatesTable.$inferSelect;
