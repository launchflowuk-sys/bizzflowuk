import { pgTable, text, serial, timestamp, integer, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { leadsTable } from "./leads";

export const sentEmailStatusEnum = pgEnum("sent_email_status", ["sent", "failed"]);

// Outbound-only log of manually composed emails Mark sends from the dashboard — not a synced
// inbox. Every send is rendered through the same branded shell as the automated notifications.
export const sentEmailsTable = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  sentByUserId: integer("sent_by_user_id").references(() => usersTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  attachmentUrls: jsonb("attachment_urls").$type<string[]>().default([]),
  status: sentEmailStatusEnum("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sent_emails_tenant_id_idx").on(table.tenantId),
  index("sent_emails_lead_id_idx").on(table.leadId),
]);

export const insertSentEmailSchema = createInsertSchema(sentEmailsTable).omit({ id: true, createdAt: true });
export type InsertSentEmail = z.infer<typeof insertSentEmailSchema>;
export type SentEmail = typeof sentEmailsTable.$inferSelect;
