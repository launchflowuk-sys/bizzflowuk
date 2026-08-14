import { pgTable, text, serial, timestamp, integer, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { leadsTable } from "./leads";

export const sentEmailStatusEnum = pgEnum("sent_email_status", ["sent", "failed"]);

// Outbound-only log of every email the platform sends — both the ones a tenant composes by hand
// and the automated notifications. Not a synced inbox.
//
// Automated sends were originally invisible here, which meant a tenant had no way to tell a
// delivered quote from one that SMTP silently dropped (sendEmail no-ops when unconfigured and
// fireNotification swallows its errors). Logging every attempt, including the failures and the
// not-configured case, is what turns "I think it sent" into something checkable (0020).
export const sentEmailsTable = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  /** Notification event that produced this ("lead_new", "quote_sent", …). Null = composed by hand. */
  event: text("event"),
  sentByUserId: integer("sent_by_user_id").references(() => usersTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  /** Null when a send failed before a body was rendered, e.g. SMTP was never configured. */
  bodyHtml: text("body_html"),
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
