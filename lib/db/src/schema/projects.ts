import { pgTable, text, serial, timestamp, integer, pgEnum, boolean, jsonb, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { usersTable } from "./users";
import { quotesTable } from "./quotes";
import { servicesTable } from "./services";

export const projectStatusEnum = pgEnum("project_status", ["Enquiry", "Survey Booked", "Quote Approved", "Scheduled", "In Progress", "Completed"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  quoteId: integer("quote_id").references(() => quotesTable.id),
  /**
   * Which of the tenant's services this job is (migration 0045).
   *
   * Nullable on purpose: plenty of jobs are one-offs that map to nothing
   * on the price list, and refusing to save one for that reason would be
   * worse than leaving it blank.
   */
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("Enquiry"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  /** Dispatch. Points at users (staff), never at the team table (website content). */
  assignedUserId: integer("assigned_user_id").references(() => usersTable.id),
  allDay: boolean("all_day").notNull().default(false),
  colour: text("colour"),
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

/**
 * Private, revocable calendar feed tokens.
 *
 * Kept off the users table so revoking a feed never touches the login record.
 */
export const calendarFeedsTable = pgTable("calendar_feeds", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  token: text("token").notNull(),
  label: text("label"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CalendarFeed = typeof calendarFeedsTable.$inferSelect;

/**
 * The estimated work on a job (migration 0045).
 *
 * Modelled on quote_items deliberately: same columns, same numeric precision.
 * A job priced up on the doorstep becomes a quote or an invoice later, and a
 * total calculated here must never disagree with one calculated there by a
 * penny.
 *
 * These live on the JOB rather than only on a quote because a trade pricing a
 * callout on somebody's doorstep is not writing a quote. They are writing down
 * what they will do and roughly what it costs. Forcing that through a quote
 * first is our data model leaking into their morning.
 */
export const projectItemsTable = pgTable("project_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, t => ({
  byProject: index("project_items_project_idx").on(t.projectId, t.sortOrder),
}));

export const insertProjectItemSchema = createInsertSchema(projectItemsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertProjectItem = z.infer<typeof insertProjectItemSchema>;
export type ProjectItem = typeof projectItemsTable.$inferSelect;
