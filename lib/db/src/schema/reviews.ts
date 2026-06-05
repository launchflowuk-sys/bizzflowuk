import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";

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
  serviceId: integer("service_id"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
