import { pgTable, text, serial, timestamp, integer, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { leadsTable } from "./leads";

export const quoteStatusEnum = pgEnum("quote_status", ["Draft", "Sent", "Accepted", "Rejected"]);

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  reference: text("reference").notNull(),
  status: quoteStatusEnum("status").notNull().default("Draft"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const quoteItemsTable = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotesTable.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;

export const insertQuoteItemSchema = createInsertSchema(quoteItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItemsTable.$inferSelect;
