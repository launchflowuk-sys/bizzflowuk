import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable, invoiceItemsTable, invoicePaymentsTable,
  quotesTable, quoteItemsTable, customersTable,
  tenantsTable, tenantSettingsTable, INVOICE_RECURRENCES,
} from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireTenantAccess } from "../middlewares/auth";
import { computeTotals, deriveStatus, outstanding } from "../lib/invoices/totals";
import { nextInvoiceReference } from "../lib/invoices/reference";
import { firstOccurrenceAfter } from "../lib/invoices/recurring";

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
 * The tenant's registration is the authority on VAT — nothing else can override
 * it. A quote carries vatRate 20 by schema default, so before this a business
 * that is not VAT registered got 20% added to an invoice converted from a quote:
 * VAT it cannot legally charge, on a document going to a customer. Caught by the
 * full-flow smoke test.
 */
export function resolveVatRate(
  tenantRate: string | null,
  requested: string | number | null | undefined,
): string | null {
  if (tenantRate === null) return null;                 // not registered: never VAT
  if (requested === undefined) return tenantRate;        // not specified: tenant default
  if (requested === null || requested === "") return null; // explicitly none
  return String(requested);
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
  const effectiveVat = resolveVatRate(tax.vatRate, inv.vatRate ?? undefined);
  const totals = computeTotals(
    // Per-line rates are dropped entirely when the tenant is not registered —
    // otherwise a stale line rate would reintroduce VAT on the next edit.
    items.map(i => ({
      description: i.description, quantity: i.quantity, unitPrice: i.unitPrice,
      vatRate: effectiveVat === null ? null : i.vatRate,
    })),
    effectiveVat,
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

    /**
     * Derive the status for display rather than trusting the stored one.
     *
     * `deriveStatus` runs when an invoice is RECALCULATED — that is, when
     * somebody edits it or a payment lands. Nothing recalculates an invoice
     * merely because a day passed, so an invoice that quietly goes past its due
     * date keeps `status: 'sent'` in the database, the list filters on
     * `status === 'overdue'` and finds none, and the Overdue total reads £0.00
     * while money is genuinely late. That is the one number on the screen a
     * business cannot afford to be wrong.
     *
     * Derived on read, not written: a GET should not have side effects, and
     * the stored value is corrected the next time the invoice is touched for a
     * real reason.
     */
    res.json(rows.map(r => ({
      ...r,
      status: deriveStatus({
        current: r.status,
        total: r.total,
        amountPaid: r.amountPaid,
        dueOn: r.dueOn,
      }),
      storedStatus: r.status,
      outstanding: outstanding(r.total, r.amountPaid),
    })));
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
    res.json({
      ...inv,
      // Same derivation as the list, so a detail page never disagrees with the
      // row that was clicked to reach it.
      status: deriveStatus({ current: inv.status, total: inv.total, amountPaid: inv.amountPaid, dueOn: inv.dueOn }),
      storedStatus: inv.status,
      items, payments,
      outstanding: outstanding(inv.total, inv.amountPaid),
    });
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
    const effectiveVat = resolveVatRate(tax.vatRate, input.vatRate);
    const totals = computeTotals(input.items ?? [], effectiveVat, tax.cisRate);

    const issuedOn = input.issuedOn ?? new Date().toISOString().slice(0, 10);
    // The tenant's own payment terms, not a hardcoded 14. `paymentDays` has
    // been in tenant_settings since 0032 and nothing read it, so a business
    // that works on 30 days had every invoice dated 14 and every chase
    // automation firing a fortnight early. Still only a default — editable
    // before it is sent.
    const [terms] = await db.select({ days: tenantSettingsTable.paymentDays })
      .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
    const dueOn = input.dueOn ?? (() => {
      const d = new Date(`${issuedOn}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + (terms?.days ?? 14));
      return d.toISOString().slice(0, 10);
    })();

    const [inv] = await db.insert(invoicesTable).values({
      tenantId,
      customerId: input.customerId ?? null,
      quoteId: input.quoteId ?? null,
      projectId: input.projectId ?? null,
      reference: await nextInvoiceReference(tenantId),
      status: "draft",
      issuedOn,
      dueOn,
      vatRate: effectiveVat,
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
    // The quote's rate only counts if the tenant is actually VAT registered.
    const effectiveVat = resolveVatRate(tax.vatRate, quote.vatRate ?? undefined);
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
      reference: await nextInvoiceReference(tenantId),
      status: "draft",
      issuedOn,
      dueOn: due.toISOString().slice(0, 10),
      vatRate: effectiveVat,
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
      const lineVat = resolveVatRate(tax.vatRate, input.vatRate === undefined ? (inv.vatRate ?? undefined) : input.vatRate);
      const totals = computeTotals(
        input.items.map(i => ({ ...i, vatRate: lineVat === null ? null : i.vatRate })),
        lineVat, tax.cisRate,
      );
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

// ── Repeating work ───────────────────────────────────────────────────────────

const recurrenceSchema = z.object({
  recurrence: z.enum(INVOICE_RECURRENCES).nullable(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  autoSend: z.boolean().optional(),
});

/**
 * Turn this invoice into the head of a repeating series, change its cadence,
 * or stop it.
 *
 * The invoice itself is the template — it is a real invoice the customer
 * really received, and each cycle the sweep clones it. Passing
 * `recurrence: null` stops the series; the copies already issued stay exactly
 * where they are, because they are real invoices and some of them are paid.
 */
router.put("/invoices/:id/recurrence", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);
    const [inv] = await db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId))).limit(1);
    if (!inv) { res.status(404).json({ error: "Not found" }); return; }
    if (inv.status === "void") { res.status(409).json({ error: "A void invoice cannot repeat." }); return; }

    const parsed = recurrenceSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid schedule", details: parsed.error.issues }); return; }
    const { recurrence, until, autoSend } = parsed.data;

    if (recurrence === null) {
      await db.update(invoicesTable)
        .set({ recurrence: null, recurrenceNextOn: null, recurrenceUntil: null })
        .where(eq(invoicesTable.id, id));
      const stopped = await recalc(id, tenantId);
      res.json({ ...stopped, items: (await loadItems([id])).get(id) ?? [] });
      return;
    }

    // A copy cannot become a head. Allowing it would fork the series, and the
    // customer would start getting two of everything.
    if (inv.recurrenceSourceId) {
      res.status(409).json({
        error: "This invoice was issued by a repeating series. Change the schedule on the first invoice in the series instead.",
      });
      return;
    }

    const issuedOn = inv.issuedOn ?? new Date().toISOString().slice(0, 10);
    // Counted from the invoice that already exists, so the next copy is the
    // NEXT one — setting a monthly schedule in March must not immediately
    // reissue March.
    const nextOn = firstOccurrenceAfter(issuedOn, recurrence);

    if (until && until < nextOn) {
      res.status(422).json({ error: "That end date is before the next invoice would be due." });
      return;
    }

    await db.update(invoicesTable).set({
      recurrence,
      recurrenceNextOn: nextOn,
      recurrenceUntil: until ?? null,
      ...(autoSend === undefined ? {} : { recurrenceAutoSend: autoSend }),
    }).where(eq(invoicesTable.id, id));

    const updated = await recalc(id, tenantId);
    res.json({ ...updated, items: (await loadItems([id])).get(id) ?? [] });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Every invoice this series has produced, newest first. */
router.get("/invoices/:id/series", requireTenantAccess, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const tenantId = tid(req);
    const rows = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.recurrenceSourceId, id),
    )).orderBy(desc(invoicesTable.issuedOn));
    res.json(rows.map(r => ({ ...r, outstanding: outstanding(r.total, r.amountPaid) })));
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
export { taxSettings, loadItems, recalc };
