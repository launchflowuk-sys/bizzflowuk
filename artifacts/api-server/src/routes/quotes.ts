import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { quotesTable, quoteItemsTable, projectsTable, leadsTable, customersTable, tenantsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";
import { sanitizeUpdate } from "../lib/sanitizeUpdate";
import { ensureCustomerForQuote } from "../lib/customerSync";
import { deleteQuotesDeep } from "../lib/cascadeDelete";

const router = Router();

const PLATFORM_BASE_URL = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";

/** Builds the customer-facing URL for a payment link, honoring a tenant's custom domain if set. */
export function buildPayUrl(opts: { customDomain?: string | null; tenantSlug: string; token: string }): string {
  if (opts.customDomain) return `https://${opts.customDomain}/pay/${opts.token}`;
  return `${PLATFORM_BASE_URL}/site/${opts.tenantSlug}/pay/${opts.token}`;
}

/** Resolves the customer name/email/phone to notify for a quote, from its linked customer or lead. */
export async function resolveQuoteRecipient(quote: { customerId: number | null; leadId: number | null }): Promise<{
  firstName?: string; lastName?: string; customerEmail?: string; customerPhone?: string;
}> {
  if (quote.customerId) {
    const rows = await db.select().from(customersTable).where(eq(customersTable.id, quote.customerId)).limit(1);
    const c = rows[0];
    if (c) return { firstName: c.firstName, lastName: c.lastName, customerEmail: c.email ?? undefined, customerPhone: c.phone ?? undefined };
  } else if (quote.leadId) {
    const rows = await db.select().from(leadsTable).where(eq(leadsTable.id, quote.leadId)).limit(1);
    const l = rows[0];
    if (l) return { firstName: l.firstName ?? undefined, lastName: l.lastName ?? undefined, customerEmail: l.email ?? undefined, customerPhone: l.phone ?? undefined };
  }
  return {};
}

router.get("/quotes", requireTenantAccess, async (req, res) => {
  try {
    const quotes = await db.select().from(quotesTable)
      .where(tenantFilter(req, quotesTable.tenantId))
      .orderBy(sql`${quotesTable.createdAt} desc`);
    res.json(quotes);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/quotes", requireTenantAccess, async (req, res) => {
  try {
    const ref = req.body.reference ?? `QUO-${Date.now()}`;
    const q = await db.insert(quotesTable).values({ ...req.body, reference: ref, tenantId: req.authUser?.tenantId ?? -1 }).returning();
    res.status(201).json(q[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    const q = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(q[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    const before = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    const q = await db.update(quotesTable).set(sanitizeUpdate(req.body))
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .returning();
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(q[0]);

    const newStatus = req.body.status;
    if (newStatus && before[0]?.status !== newStatus) {
      // Note: manually flipping status here is bookkeeping only — it never emails the customer.
      // The customer is only ever notified about a quote via the explicit "Send Payment Link"
      // action (POST /payment-links/:id/send in paymentLinks.ts), which includes the real amount
      // and pay link. Firing a "quote sent" email from a bare status change produced a duplicate,
      // content-less email with no payment link, since this handler has no amount to attach.
      if (newStatus === "Accepted") {
        // Deal closed → make sure this person is a saved customer (see customerSync). Best-effort:
        // a hiccup here must never fail the status update the tenant just made.
        ensureCustomerForQuote(q[0].id).catch(e => req.log.error({ err: e }, "ensureCustomerForQuote failed"));
        const recipient = await resolveQuoteRecipient(q[0]);
        fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", ...recipient, reference: q[0].reference });
      }
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/quotes/:id", requireTenantAccess, async (req, res) => {
  try {
    // Verify ownership first, then deep-delete (items die with the quote; payment links and any
    // converted project unlink). A bare delete FK-violated (HTTP 500) on any quote with items.
    const owned = await db.select({ id: quotesTable.id }).from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId))).limit(1);
    if (owned.length) await deleteQuotesDeep([owned[0].id]);
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Path matches the OpenAPI spec (/quotes/{id}/convert-project) — this was originally
// registered as "convert-to-project", so the generated client 404'd on every call and
// the dashboard's quote-level "Convert to Project" button had never actually worked.
router.post("/quotes/:id/convert-project", requireTenantAccess, async (req, res) => {
  try {
    const q = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    if (!q.length) { res.status(404).json({ error: "Not found" }); return; }
    // Closing the quote into a project means it's accepted → ensure the customer exists and hang
    // both the quote and the new project off them. Tolerant: if this fails we still make the project.
    let customerId = q[0].customerId ?? undefined;
    try { customerId = (await ensureCustomerForQuote(q[0].id)) ?? customerId; }
    catch (e) { req.log.error({ err: e }, "ensureCustomerForQuote failed during convert-project"); }
    const project = await db.insert(projectsTable).values({
      tenantId: q[0].tenantId,
      quoteId: q[0].id,
      customerId: customerId ?? undefined,
      title: `Project from ${q[0].reference}`,
    }).returning();
    await db.update(quotesTable).set({ status: "Accepted" }).where(eq(quotesTable.id, q[0].id));
    res.status(201).json(project[0]);

    const recipient = await resolveQuoteRecipient(q[0]);
    fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", ...recipient, reference: q[0].reference });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Confirms :id refers to a quote the caller's tenant actually owns (or bypasses for SUPER_ADMIN). */
export async function requireOwnedQuote(req: any, res: any): Promise<number | null> {
  const quote = await db.select({ id: quotesTable.id }).from(quotesTable)
    .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
    .limit(1);
  if (!quote.length) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return quote[0].id;
}

router.get("/quotes/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const quoteId = await requireOwnedQuote(req, res);
    if (quoteId === null) return;
    const items = await db.select().from(quoteItemsTable)
      .where(eq(quoteItemsTable.quoteId, quoteId))
      .orderBy(quoteItemsTable.sortOrder);
    res.json(items);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/quotes/:id/items", requireTenantAccess, async (req, res) => {
  try {
    const quoteId = await requireOwnedQuote(req, res);
    if (quoteId === null) return;
    const item = await db.insert(quoteItemsTable).values({ ...req.body, quoteId }).returning();
    res.status(201).json(item[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/quotes/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    const quoteId = await requireOwnedQuote(req, res);
    if (quoteId === null) return;
    const item = await db.update(quoteItemsTable).set(sanitizeUpdate(req.body))
      .where(and(eq(quoteItemsTable.id, Number(req.params.itemId)), eq(quoteItemsTable.quoteId, quoteId)))
      .returning();
    if (!item.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(item[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/quotes/:id/items/:itemId", requireTenantAccess, async (req, res) => {
  try {
    const quoteId = await requireOwnedQuote(req, res);
    if (quoteId === null) return;
    await db.delete(quoteItemsTable)
      .where(and(eq(quoteItemsTable.id, Number(req.params.itemId)), eq(quoteItemsTable.quoteId, quoteId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
