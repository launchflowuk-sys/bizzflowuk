import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { quotesTable, quoteItemsTable, projectsTable, leadsTable, customersTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { fireNotification } from "../lib/notifications";
import { sanitizeUpdate, coerceTimestamps } from "../lib/sanitizeUpdate";
import { ensureCustomerForQuote } from "../lib/customerSync";
import { deleteQuotesDeep } from "../lib/cascadeDelete";

const router = Router();

const PLATFORM_BASE_URL = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";

/** Builds the customer-facing URL for a payment link, honoring a tenant's custom domain if set. */
export function buildPayUrl(opts: { customDomain?: string | null; tenantSlug: string; token: string }): string {
  if (opts.customDomain) return `https://${opts.customDomain}/pay/${opts.token}`;
  return `${PLATFORM_BASE_URL}/site/${opts.tenantSlug}/pay/${opts.token}`;
}

/**
 * Builds the next human-readable quote reference for a tenant, e.g. "AMO-R-0007".
 *
 * The prefix is per-tenant (tenant_settings.quote_ref_prefix) because references are shown to
 * customers — hardcoding one tenant's prefix would brand every other tenant's quotes wrongly.
 * Falls back to "QUO" for tenants that haven't set one, which is the historic format.
 *
 * Numbering counts only references already matching this tenant's current prefix, so switching
 * prefix starts a fresh sequence rather than inheriting old numbers. Legacy timestamp-style
 * references (QUO-1786711199250) are ignored by the 1-6 digit bound, so an old quote can't push
 * the next number into the billions.
 */
export async function nextQuoteReference(tenantId: number): Promise<string> {
  const settings = await db.select({ prefix: tenantSettingsTable.quoteRefPrefix })
    .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  const prefix = settings[0]?.prefix?.trim() || "QUO";

  const rows = await db.select({ reference: quotesTable.reference })
    .from(quotesTable)
    .where(and(eq(quotesTable.tenantId, tenantId), sql`${quotesTable.reference} ~ ${`^${prefix}-[0-9]{1,6}$`}`));

  const highest = rows.reduce((max, r) => {
    const n = Number(r.reference.slice(prefix.length + 1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Resolves the customer name/email/phone to notify for a quote, from its linked
 * customer or lead.
 *
 * **Both lookups are filtered by the quote's own tenant, and that is not
 * optional.** They used to match on id alone. `quotes.customer_id` and
 * `quotes.lead_id` are plain foreign keys with no tenant constraint, so a quote
 * carrying another tenant's lead id resolved that tenant's customer — their
 * name, their email address, their phone number — and this function feeds the
 * quote email, the payment-link email and the **public, unauthenticated** pay
 * page in publicPayments.ts. One tenant's customer details could be rendered to
 * a stranger on another tenant's pay page.
 *
 * Found by an e2e run that accidentally authenticated as one tenant while
 * posting an enquiry to another: it produced two live quotes in tenant 8
 * pointing at leads owned by tenant 4.
 *
 * Filtering here closes the read. `assertOwnedRefs` below stops the bad link
 * being created in the first place; this is the second line, and it is the one
 * that protects the quotes already in the database.
 */
export async function resolveQuoteRecipient(quote: {
  tenantId: number; customerId: number | null; leadId: number | null;
}): Promise<{
  firstName?: string; lastName?: string; customerEmail?: string; customerPhone?: string;
}> {
  if (quote.customerId) {
    const rows = await db.select().from(customersTable)
      .where(and(eq(customersTable.id, quote.customerId), eq(customersTable.tenantId, quote.tenantId)))
      .limit(1);
    const c = rows[0];
    if (c) return { firstName: c.firstName, lastName: c.lastName, customerEmail: c.email ?? undefined, customerPhone: c.phone ?? undefined };
  } else if (quote.leadId) {
    const rows = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.id, quote.leadId), eq(leadsTable.tenantId, quote.tenantId)))
      .limit(1);
    const l = rows[0];
    if (l) return { firstName: l.firstName ?? undefined, lastName: l.lastName ?? undefined, customerEmail: l.email ?? undefined, customerPhone: l.phone ?? undefined };
  }
  return {};
}

/**
 * Rejects a body that points at another tenant's customer or lead.
 *
 * `POST /quotes` spreads `req.body` into the insert. It forces `tenantId`, so a
 * caller cannot plant a row in someone else's tenant — but `customerId` and
 * `leadId` went through untouched, and neither column is tenant-constrained at
 * the database level. That let a tenant attach its own quote to a stranger's
 * lead, which is both a broken record and the input to the leak above.
 *
 * Returns an error message, or null when everything checks out.
 */
export async function assertOwnedRefs(
  tenantId: number,
  body: { customerId?: unknown; leadId?: unknown },
): Promise<string | null> {
  const customerId = Number(body.customerId);
  if (body.customerId != null && Number.isFinite(customerId)) {
    const [row] = await db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId))).limit(1);
    if (!row) return "That customer does not belong to this business.";
  }
  const leadId = Number(body.leadId);
  if (body.leadId != null && Number.isFinite(leadId)) {
    const [row] = await db.select({ id: leadsTable.id }).from(leadsTable)
      .where(and(eq(leadsTable.id, leadId), eq(leadsTable.tenantId, tenantId))).limit(1);
    if (!row) return "That lead does not belong to this business.";
  }
  return null;
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
    const tenantId = req.authUser?.tenantId ?? -1;
    // customer_id and lead_id are plain foreign keys with no tenant constraint,
    // so without this a caller can link their quote to a stranger's record.
    const refError = await assertOwnedRefs(tenantId, req.body);
    if (refError) { res.status(400).json({ error: refError }); return; }

    const ref = req.body.reference ?? await nextQuoteReference(req.authUser?.tenantId ?? -1);
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
    // An update can re-point customer_id / lead_id just as an insert can.
    const refError = await assertOwnedRefs(req.authUser?.tenantId ?? -1, req.body);
    if (refError) { res.status(400).json({ error: refError }); return; }

    const before = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.id, Number(req.params.id)), tenantFilter(req, quotesTable.tenantId)))
      .limit(1);
    const q = await db.update(quotesTable).set(sanitizeUpdate(coerceTimestamps(req.body)))
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
        fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", quoteId: q[0].id, ...recipient, reference: q[0].reference });
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
    fireNotification({ tenantId: q[0].tenantId, event: "quote_accepted", quoteId: q[0].id, ...recipient, reference: q[0].reference });
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
    const itemId = Number(req.params.itemId);
    const existing = await db.select().from(quoteItemsTable)
      .where(and(eq(quoteItemsTable.id, itemId), eq(quoteItemsTable.quoteId, quoteId)))
      .limit(1);
    if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

    // `total` is derived, never taken from the client: the quote subtotal is the sum of these,
    // so a caller that edits quantity but forgets total would silently misprice the whole quote.
    const patch = sanitizeUpdate(coerceTimestamps(req.body)) as Record<string, unknown>;
    const quantity = patch.quantity ?? existing[0].quantity;
    const unitPrice = patch.unitPrice ?? existing[0].unitPrice;
    patch.total = (Number(quantity) * Number(unitPrice)).toFixed(2);

    const item = await db.update(quoteItemsTable).set(patch)
      .where(and(eq(quoteItemsTable.id, itemId), eq(quoteItemsTable.quoteId, quoteId)))
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
