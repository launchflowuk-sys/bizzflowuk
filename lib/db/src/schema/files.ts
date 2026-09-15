import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

/**
 * The paperwork a trade has to be able to produce on a phone.
 *
 * Public liability certificate, Gas Safe card, COSHH sheets, risk assessments,
 * blank forms. The bytes live in the object storage service, which is already
 * tenant-scoped; this is the index over them.
 *
 * `objectPath` is the PRIVATE path. It is never rendered as a link directly —
 * reaching a file goes through the signed-token storage route, so a URL that
 * leaks out of the business stops working rather than staying open forever.
 */
export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  /** insurance | gas_safe | coshh | risk_assessment | method_statement | template | other */
  category: text("category").notNull().default("other"),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  notes: text("notes"),
  /** NULL means it does not expire. Insurance and Gas Safe cards do. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  /** Surfaces first, for the two or three you actually reach for on site. */
  pinned: boolean("pinned").notNull().default(false),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("files_tenant_id_idx").on(table.tenantId),
  index("files_tenant_category_idx").on(table.tenantId, table.category),
  index("files_expires_at_idx").on(table.expiresAt),
]);

export const insertFileSchema = createInsertSchema(filesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFile = z.infer<typeof insertFileSchema>;

/** The categories the UI offers, in the order it offers them. */
export const FILE_CATEGORIES = [
  { key: "insurance", label: "Insurance" },
  { key: "gas_safe", label: "Gas Safe" },
  { key: "coshh", label: "COSHH sheets" },
  { key: "risk_assessment", label: "Risk assessments" },
  { key: "method_statement", label: "Method statements" },
  { key: "template", label: "Templates & forms" },
  { key: "other", label: "Other" },
] as const;
