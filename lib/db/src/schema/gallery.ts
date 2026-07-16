import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { servicesTable } from "./services";
import { areasTable } from "./areas";

export const galleryImagesTable = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id),
  areaId: integer("area_id").references(() => areasTable.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  altText: text("alt_text"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("gallery_images_tenant_id_idx").on(table.tenantId),
  index("gallery_images_service_id_idx").on(table.serviceId),
  index("gallery_images_area_id_idx").on(table.areaId),
]);

export const beforeAfterTable = pgTable("before_after", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  beforeImageUrl: text("before_image_url").notNull(),
  afterImageUrl: text("after_image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("before_after_tenant_id_idx").on(table.tenantId),
  index("before_after_service_id_idx").on(table.serviceId),
]);

export const insertGalleryImageSchema = createInsertSchema(galleryImagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGalleryImage = z.infer<typeof insertGalleryImageSchema>;
export type GalleryImage = typeof galleryImagesTable.$inferSelect;

export const insertBeforeAfterSchema = createInsertSchema(beforeAfterTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBeforeAfter = z.infer<typeof insertBeforeAfterSchema>;
export type BeforeAfter = typeof beforeAfterTable.$inferSelect;
