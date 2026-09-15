import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { servicesTable } from "./services";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  reviewerName: text("reviewer_name").notNull(),
  reviewerLocation: text("reviewer_location"),
  rating: integer("rating").notNull().default(5),
  title: text("title"),
  content: text("content").notNull(),
  platform: text("platform").default("Website"),
  platformUrl: text("platform_url"),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(true),
  serviceId: integer("service_id").references(() => servicesTable.id),
  photoUrl: text("photo_url"),
  /** Identifies a pulled review so a re-sync updates rather than duplicates.
   *  Google exposes no review id, so this is a stable hash of author + time. */
  externalId: text("external_id"),
  /** When the customer wrote it, not when we fetched it. */
  sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("reviews_tenant_id_idx").on(table.tenantId),
  index("reviews_customer_id_idx").on(table.customerId),
  index("reviews_service_id_idx").on(table.serviceId),
]);

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
