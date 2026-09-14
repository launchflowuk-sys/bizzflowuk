import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable, invoiceItemsTable, invoicePaymentsTable,
  quotesTable, quoteItemsTable, customersTable,
  tenantsTable, tenantSettingsTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";
import { computeTotals, deriveStatus, outstanding } from "../lib/invoices/totals";

const router = Router();

function tid(req: any): number { return req.authUser?.tenantId!; }

const lineSchema = z.object({
  description: z.string().min(1, "Every line needs a description"),
  quantity: z.union([z.string(), z.number()]).optional(),
  unitPrice: z.union([z.string(), z.number()]),
  vatRate: z.union([z.string(), z.number()]).nullable().optional(),
});

const invoiceInputSchema = z.object({
  customerId: z.number().int().nullable().optional(),
  quoteId: z.number().int().nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  issuedOn: z.string().nullable().optional(),
  dueOn: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  isDeposit: z.boolean().optional(),
  /** Overrides the tenant default. Explicit null means "no VAT on this invoice". */
  vatRate: z.union([z.string(), z.number()]).nullable().optional(),
  items: z.array(lineSchema).optional(),
});

const paymentSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  paidOn: z.string().optional(),
  method: z.enum(["card", "bank_transfer", "cash", "cheque", "other"]).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Next invoice reference, e.g. "BPS-INV-0007".
 *
 * Shares the per-tenant prefix with quotes and certificates so a business's
 * paperwork reads as one set of documents. Counts only references already on this
 * exact prefix, so changing the prefix starts a fresh sequence.
 */
async function nextReference(tenantId: number): Promise<string> {
  const [settings] = await db.select({ prefix: tenantSettingsTable.quoteRefPrefix })
    .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  // A tenant with no prefix set gets a plain "INV-0001" rather than "INV-INV-0001".
  const prefix = settings?.prefix ? settings.prefix.toUpperCase() : null;
  const base = prefix ? `${prefix}-INV` : "INV";

  const rows = await db.select({ reference: invoicesTable.reference })
    .from(invoicesTable)
    .where(and(
      eq(invoicesTable.tenantId, tenantId),
      sql`${invoicesTable.reference} ~ ${`^${base}-[0-9]{1,6}$`}`,
    ));

  let max = 0;
  for (const r of rows) {
    const n = Number(r.reference.slice(base.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${base}-${String(max + 1).padStart(4, "0")}`;
}

/** Tenant VAT and CIS settings. Absent means not registered, so no VAT is charged. */
async function taxSettings(tenantId: number): Promise<{ vatRate: string | null; cisRate: string | null }> {
  const [s] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  const any = s as any;
  return {
    vatRate: any?.vatRegistered ? (any?.vatRate ?? "20") : null,
    cisRate: any?.cisRegistered ? (any?.cisRate ?? "20") : null,
  };
}

async function loadItems(invoiceIds: number[]) {
  if (!invoiceIds.length) return new Map<number, any[]>();
  const rows = await db.select().from(invoiceItemsTable)
    .where(inArray(invoiceItemsTable.invoiceId, invoiceIds))
    .orderBy(invoiceItemsTable.sortOrder);
  const by = new Map<number, any[]>();
  for (const r of rows) {
    const l = by.get(r.invoiceId) ?? [];
    l.push(r); by.set(r.invoiceId, l);
  }
  return by;
}

async function loadPayments(invoiceId: number) {
  return db.select().from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))
    .orderBy(desc(invoicePaymentsTable.paidOn));
}

/** Recalculates totals from the stored lines and writes back status + amounts. */
async function recalc(invoiceId: number, tenantId: number) {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!inv) return null;

  const items = await db.select().from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId)).orderBy(invoiceItemsTable.sortOrder);

  const tax = await taxSettings(tenantId);
  const totals = computeTotals(
    items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate })),
    inv.vatRate ?? tax.vatRate,
    tax.cisRate,
  );

  const payments = await loadPayments(invoiceId);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2);

  const status = deriveStatus({
    current: inv.status,
    total: totals.total,
    amountPaid: paid,
    dueOn: inv.dueOn,
  });

  const [updated] = await db.update(invoicesTable).set({
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    cisDeduction: totals.cisDeduction,
    total: totals.total,
    amountPaid: paid,
    status,
    paidAt: status === "paid" ? (inv.paidAt ?? new Date()) : null,
  }).where(eq(invoicesTable.id, invoiceId)).returning();

  return updated;
}

// ── List ─────────────────────────────────────────────────────────────────────

router.get("/invoices", requireTenantAccess, async (req: any, res) => {
  try {
    const { status, customerId, overdue } = req.query as Record<string, string | undefined>;
    const filters = [eq(invoicesTable.tenantId, tid(req))];
    if (status) filters.push(eq(invoicesTable.status, status));
    if (customerId) filters.push(eq(invoicesTable.customerId, Number(customerId)));
    if (overdue === "true") {
      filters.push(sql`${invoicesTable.dueOn} < CURRENT_DATE`);
      filters.push(inArray(invoicesTable.status, ["sent", "part_paid", "overdue"]));
    }

    const rows = await db.select().from(invoicesTable)
      .where(and(...filters))
      .orderBy(desc(invoicesTable.issuedOn), desc(invoicesTable.id))
      .limit(500);

    res.json(rows.map(r => ({ ...r, outstanding: outstanding(r.total, r.amountPaid) })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Read one ─────────────────────────────────────────────────────────────────

router.get("/invoices/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tid(req)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }

    const items = (await loadItems([id])).get(id) ?? [];
    const payments = await loadPayments(id);
    res.json({ ...inv, items, payments, outstanding: outstanding(inv.total, inv.amountPaid) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Create ───────────────────────────────────────────────────────────────────

router.post("/invoices", requireTenantAccess, async (req: any, res) => {
  try {
    const parsed = invoiceInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid invoice", details: parsed.error.issues }); return; }
    const input = parsed.data;
    const tenantId = tid(req);

    const tax = await taxSettings(tenantId);
    const effectiveVat = input.vatRate === undefined ? tax.vatRate : input.vatRate;
    const totals = computeTotals(input.items ?? [], effectiveVat, tax.cisRate);

    const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);
    // 14 days is the trade norm and it is only a default — editable before sending.
    const dueOn = input.dueOn ?? (() => {
      const d = new Date(`${issuedOn}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 14);
      return d.toISOString().slice(0, 10);
    })();

    const [inv] = await db.insert(invoicesTable).values({
      tenantId,
      customerId: input.customerId ?? null,
      quoteId: input.quoteId ?? null,
      projectId: input.projectId ?? null,
      reference: await nextReference(tenantId),
      status: "draft",
      issuedOn,
      dueOn,
      vatRate: effectiveVat === null || effectiveVat === undefined ? null : String(effectiveVat),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      cisDeduction: totals.cisDeduction,
      total: totals.total,
      isDeposit: input.isDeposit ?? false,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
    }).returning();

    if (input.items?.length) {
      await db.insert(invoiceItemsTable).values(totals.lines.map((l, i) => ({
        invoiceId: inv.id,
        description: l.description,
        quantity: String(l.quantity ?? 1),
        unitPrice: String(l.unitPrice),
        vatRate: l.vatRate,
        total: l.total,
        sortOrder: i,
      })));
    }

    const items = (await loadItems([inv.id])).get(inv.id) ?? [];
    res.status(201).json({ ...inv, items, payments: [], outstanding: outstanding(inv.total, inv.amountPaid) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Convert an accepted quote ────────────────────────────────────────────────

/**
 * The quote's lines carry over so nothing is retyped. Refuses to convert twice —
 * duplicate invoices for one job is the mistake that costs a customer's trust.
 */
router.post("/quotes/:id/convert-invoice", requireTenantAccess, async (req: any, res) => {
  try {
    const quoteId = Number(req.params.id);
    const tenantId = tid(req);

    const [quote] = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.tenantId, tenantId))).limit(1);
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }

    const [existing] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.quoteId, quoteId), sql`${invoicesTable.status} <> 'void'`)).limit(1);
    if (existing) {
      res.status(409).json({ error: "This quote has already been invoiced.", invoiceId: existing.id });
      return;
    }

    const qItems = await db.select().from(quoteItemsTable)
      .where(eq(quoteItemsTable.quoteId, quoteId)).orderBy(quoteItemsTable.sortOrder);

    const tax = await taxSettings(tenantId);
    const effectiveVat = quote.vatRate ?? tax.vatRate;
    const totals = computeTotals(
      qItems.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      effectiveVat, tax.cisRate,
    );

    const issuedOn = new Date().toISOString().slice(0, 10);
    const due = new Date(); due.setUTCDate(due.getUTCDate() + 14);

    const [inv] = await db.insert(invoicesTable).values({
      tenantId,
      customerId: quote.customerId,
      quoteId: quote.id,
      reference: await nextReference(tenantId),
      status: "draft",
      issuedOn,
      dueOn: due.toISOString().slice(0, 10),
      vatRate: effectiveVat === null ? null : String(effectiveVat),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      cisDeduction: totals.cisDeduction,
      total: totals.total,
      notes: quote.notes,
    }).returning();

    if (totals.lines.length) {
      await db.insert(invoiceItemsTable).values(totals.lines.map((l, i) => ({
        invoiceId: inv.id,
        description: l.description,
        quantity: String(l.quantity ?? 1),
        unitPrice: String(l.unitPrice),
        vatRate: l.vatRate,
        total: l.total,
        sortOrder: i,
      })));
    }

    const items = (await loadItems([inv.id])).get(inv.id) ?? [];
    res.status(201).json({ ...inv, items, payments: [] });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Update a draft ───────────────────────────────────────────────────────────

router.patch("/invoices/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }
    if (inv.status === "void") { res.status(409).json({ error: "A void invoice cannot be edited." }); return; }

    const parsed = invoiceInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid invoice", details: parsed.error.issues }); return; }
    const input = parsed.data;

    const patch: Record<string, unknown> = {};
    for (const k of ["customerId", "projectId", "issuedOn", "dueOn", "notes", "terms", "isDeposit"] as const) {
      if (input[k] !== undefined) patch[k] = input[k];
    }
    if (input.vatRate !== undefined) patch.vatRate = input.vatRate === null ? null : String(input.vatRate);

    if (Object.keys(patch).length) {
      await db.update(invoicesTable).set(patch).where(eq(invoicesTable.id, id));
    }

    // Lines are replaced wholesale when supplied. Merging line-by-line is how a
    // deleted line survives into a sent invoice.
    if (input.items) {
      const tax = await taxSettings(tenantId);
      const totals = computeTotals(input.items, input.vatRate === undefined ? (inv.vatRate ?? tax.vatRate) : input.vatRate, tax.cisRate);
      await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
      if (totals.lines.length) {
        await db.insert(invoiceItemsTable).values(totals.lines.map((l, i) => ({
          invoiceId: id,
          description: l.description,
          quantity: String(l.quantity ?? 1),
          unitPrice: String(l.unitPrice),
          vatRate: l.vatRate,
          total: l.total,
          sortOrder: i,
        })));
      }
    }

    const updated = await recalc(id, tenantId);
    const items = (await loadItems([id])).get(id) ?? [];
    res.json({ ...updated, items, outstanding: outstanding(updated!.total, updated!.amountPaid) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Send ─────────────────────────────────────────────────────────────────────

router.post("/invoices/:id/send", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }

    const items = (await loadItems([id])).get(id) ?? [];
    const problems: string[] = [];
    if (!items.length) problems.push("An invoice needs at least one line.");
    if (!inv.customerId) problems.push("An invoice needs a customer to send it to.");
    if (Number(inv.total) <= 0) problems.push("The invoice total is zero.");
    if (problems.length) { res.status(422).json({ error: "This invoice is not ready to send", problems }); return; }

    await db.update(invoicesTable)
      .set({ status: "sent", sentAt: inv.sentAt ?? new Date() })
      .where(eq(invoicesTable.id, id));

    const updated = await recalc(id, tenantId);

    // Delivery is fired by the caller's automation config rather than forced here,
    // so sending is recorded even when email is not configured yet.
    const { sendInvoiceEmail } = await import("../lib/invoices/deliver");
    sendInvoiceEmail(id, tenantId).catch(e => req.log.error({ err: e }, "Invoice email failed"));

    res.json({ ...updated, items });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Payments ─────────────────────────────────────────────────────────────────

router.post("/invoices/:id/payments", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }
    if (inv.status === "void") { res.status(409).json({ error: "A void invoice cannot take a payment." }); return; }

    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid payment", details: parsed.error.issues }); return; }
    const p = parsed.data;

    if (Number(p.amount) <= 0) { res.status(400).json({ error: "A payment must be more than zero." }); return; }

    await db.insert(invoicePaymentsTable).values({
      invoiceId: id,
      amount: String(p.amount),
      paidOn: p.paidOn ?? new Date().toISOString().slice(0, 10),
      method: p.method ?? "bank_transfer",
      reference: p.reference ?? null,
      notes: p.notes ?? null,
    });

    const updated = await recalc(id, tenantId);
    const payments = await loadPayments(id);
    res.status(201).json({ ...updated, payments, outstanding: outstanding(updated!.total, updated!.amountPaid) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Void ─────────────────────────────────────────────────────────────────────

router.post("/invoices/:id/void", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tid(req)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }

    const [voided] = await db.update(invoicesTable)
      .set({ status: "void", voidedAt: new Date(), notes: req.body?.reason ? `${inv.notes ?? ""}\n\nVoided: ${String(req.body.reason).slice(0, 300)}`.trim() : inv.notes })
      .where(eq(invoicesTable.id, id)).returning();
    res.json(voided);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ── Delete a draft ───────────────────────────────────────────────────────────

router.delete("/invoices/:id", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tid(req)))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }
    if (inv.status !== "draft") {
      res.status(409).json({ error: "Only a draft can be deleted. Void it instead so the numbering stays intact." });
      return;
    }
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
export { nextReference, taxSettings, loadItems, recalc };
