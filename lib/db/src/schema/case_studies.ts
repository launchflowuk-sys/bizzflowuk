import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { servicesTable } from "./services";

export const caseStudiesTable = pgTable("case_studies", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  serviceId: integer("service_id").references(() => servicesTable.id),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  tagline: text("tagline"),
  clientName: text("client_name"),
  location: text("location"),
  projectDuration: text("project_duration"),
  challenge: text("challenge"),
  solution: text("solution"),
  result: text("result"),
  heroImageUrl: text("hero_image_url"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("case_studies_tenant_id_idx").on(table.tenantId),
  index("case_studies_service_id_idx").on(table.serviceId),
]);

export const insertCaseStudySchema = createInsertSchema(caseStudiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCaseStudy = z.infer<typeof insertCaseStudySchema>;
export type CaseStudy = typeof caseStudiesTable.$inferSelect;
