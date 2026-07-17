import { pgTable, text, serial, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

// Pre-rendered HTML snapshot of a public marketing page, keyed per tenant + path. Written on a
// cache miss (first request after a fresh deploy or after content changes) and wiped wholesale
// for a tenant whenever any of their public content is saved — see invalidateTenantPageCache.
export const pageRenderCacheTable = pgTable("page_render_cache", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  path: text("path").notNull(),
  html: text("html").notNull(),
  dehydratedState: jsonb("dehydrated_state").notNull(),
  renderedAt: timestamp("rendered_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("page_render_cache_tenant_path_idx").on(table.tenantId, table.path),
]);

export const insertPageRenderCacheSchema = createInsertSchema(pageRenderCacheTable).omit({ id: true, renderedAt: true });
export type InsertPageRenderCache = z.infer<typeof insertPageRenderCacheSchema>;
export type PageRenderCache = typeof pageRenderCacheTable.$inferSelect;
