import { pgTable, text, serial, timestamp, integer, numeric, boolean, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { quotesTable } from "./quotes";
import { projectsTable } from "./projects";

/**
 * Invoices — the spine the money features stand on.
 *
 * Cash flow, the VAT threshold monitor, "chase unpaid invoices" and the revenue
 * tiles all read from here. Without it none of them can exist, which is why this
 * is the first thing built rather than one feature among several.
 *
 * Mirrors the quotes table deliberately: same numeric precision, same per-tenant
 * reference pattern, same items child table. A quote converting to an invoice
 * should feel like the same document changing state, not a different system.
 *
 * `status` is text, not a pgEnum. Adding a status later must never need
 * ALTER TYPE ... ADD VALUE, which cannot run inside a transaction on some
 * Postgres versions and aborts drizzle's whole migration batch.
 */
export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  quoteId: integer("quote_id").references(() => quotesTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),

  reference: text("reference").notNull(),
  /** draft | sent | part_paid | paid | overdue | void */
  status: text("status").notNull().default("draft"),

  issuedOn: date("issued_on"),
  dueOn: date("due_on"),

  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Null when the tenant is not VAT registered — an invoice never shows VAT it was not given. */
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Construction Industry Scheme deduction, when the tenant operates CIS. */
  cisDeduction: numeric("cis_deduction", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Sum of payments recorded. Kept on the row so listing does not need a join per invoice. */
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),

  /** A deposit request rather than a full invoice — shown differently to the customer. */
  isDeposit: boolean("is_deposit").notNull().default(false),

  notes: text("notes"),
  terms: text("terms"),

  /**
   * Repeating work (migration 0046).
   *
   * Only the FIRST invoice in a series carries `recurrence` — it is a real
   * invoice the customer really received, and it doubles as the template. Each
   * cycle the sweep clones it and points the clone back here through
   * `recurrenceSourceId`. The clone carries no recurrence of its own, or every
   * copy would start a series and the tenant would wake up to a fork bomb made
   * of invoices.
   */
  recurrence: text("recurrence"),
  /** The date the next copy is due. Advanced by the sweep after each clone. */
  recurrenceNextOn: date("recurrence_next_on"),
  /** Null runs until someone stops it. */
  recurrenceUntil: date("recurrence_until"),
  /** Off by default: a wrong draft is recoverable, a wrong sent invoice is not. */
  recurrenceAutoSend: boolean("recurrence_auto_send").notNull().default(false),
  recurrenceCount: integer("recurrence_count").notNull().default(0),
  recurrenceSourceId: integer("recurrence_source_id"),

  sentAt: timestamp("sent_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  /** Latch for the chase automation, so a re-run cannot double-send. */
  lastChasedAt: timestamp("last_chased_at", { withTimezone: true }),
  chaseCount: integer("chase_count").notNull().default(0),

  pdfPath: text("pdf_path"),

  /**
   * Sample data for a walkthrough, removable exactly (migration 0049).
   * Only the demo seeder ever sets this; every real row is false.
   */
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("invoices_tenant_id_idx").on(table.tenantId),
  index("invoices_customer_id_idx").on(table.customerId),
  index("invoices_quote_id_idx").on(table.quoteId),
  // The chase sweep and the cash flow forecast both run on tenant + due date.
  index("invoices_tenant_due_idx").on(table.tenantId, table.dueOn),
]);

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  /** Per-line so a job can mix standard-rated labour with zero-rated materials. */
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("invoice_items_invoice_id_idx").on(table.invoiceId),
]);

/**
 * Payments recorded against an invoice.
 *
 * A separate table rather than a paid flag, because part payments and deposits
 * are normal in trade work and "how much is actually outstanding" is a question
 * the cash flow forecast has to answer honestly.
 */
export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidOn: date("paid_on").notNull(),
  /** card | bank_transfer | cash | cheque | other */
  method: text("method").notNull().default("bank_transfer"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("invoice_payments_invoice_id_idx").on(table.invoiceId),
]);

/**
 * Expenses — the other half of cash flow.
 *
 * Deliberately simple: enough to forecast money going out, work out a VAT
 * position and mark a cost against a job. Not a bookkeeping ledger.
 */
export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),

  supplier: text("supplier").notNull(),
  description: text("description"),
  /** materials | fuel | tools | subcontractor | insurance | vehicle | other */
  category: text("category").notNull().default("materials"),

  spentOn: date("spent_on").notNull(),
  net: numeric("net", { precision: 10, scale: 2 }).notNull().default("0"),
  vatAmount: numeric("vat_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),

  /**
   * Ordered goods that have not turned up (migration 0048).
   *
   * An expense is already the record of a purchase, so the two dates live here
   * rather than in a parallel orders table a trade would have to keep up to
   * date twice. Both nullable: most expenses are a receipt for something
   * already in the van.
   */
  expectedOn: date("expected_on"),
  receivedOn: date("received_on"),

  /** Rebillable to the customer on the job's invoice. */
  billable: boolean("billable").notNull().default(false),
  billedOnInvoiceId: integer("billed_on_invoice_id").references(() => invoicesTable.id),

  receiptPath: text("receipt_path"),
  notes: text("notes"),

  /**
   * Sample data for a walkthrough, removable exactly (migration 0049).
   * Only the demo seeder ever sets this; every real row is false.
   */
  isDemo: boolean("is_demo").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("expenses_tenant_id_idx").on(table.tenantId),
  index("expenses_tenant_spent_idx").on(table.tenantId, table.spentOn),
  index("expenses_project_id_idx").on(table.projectId),
]);

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true, createdAt: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;

export const insertInvoicePaymentSchema = createInsertSchema(invoicePaymentsTable).omit({ id: true, createdAt: true });
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;

export const INVOICE_STATUSES = ["draft", "sent", "part_paid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * The cadences a trade actually bills on. Matched by a CHECK constraint in
 * migration 0046, so adding one here means adding it there too.
 */
export const INVOICE_RECURRENCES = [
  "weekly", "fortnightly", "monthly", "quarterly", "six_monthly", "yearly",
] as const;
export type InvoiceRecurrence = (typeof INVOICE_RECURRENCES)[number];

export const EXPENSE_CATEGORIES = [
  "materials", "fuel", "tools", "subcontractor", "insurance", "vehicle", "other",
] as const;
