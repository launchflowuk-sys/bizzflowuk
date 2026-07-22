import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLinksTable, quotesTable, quoteItemsTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { paymentLinkRateLimiter } from "../middlewares/rateLimit";
import { buildSquareConfig } from "../lib/settingsHelpers";
import { createSquarePayment, SquarePaymentError } from "../lib/square";
import { fireNotification } from "../lib/notifications";
import { resolveQuoteRecipient } from "./quotes";
import { ensureCustomerForQuote, upsertCustomer } from "../lib/customerSync";

/** Split a single "First Last" name field (payment links store one name) into first/last. */
function splitName(full?: string | null): { firstName: string | null; lastName: string | null } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const router = Router();

async function loadPaymentLinkContext(token: string) {
  const linkRows = await db.select().from(paymentLinksTable).where(eq(paymentLinksTable.token, token)).limit(1);
  const link = linkRows[0];
  if (!link) return null;

  let quote = null;
  if (link.quoteId) {
    const quoteRows = await db.select().from(quotesTable).where(eq(quotesTable.id, link.quoteId)).limit(1);
    quote = quoteRows[0] ?? null;
    if (!quote) return null;
  }

  const tenantRows = await db.select().from(tenantsTable).where(eq(tenantsTable.id, link.tenantId)).limit(1);
  const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, link.tenantId)).limit(1);

  return { link, quote, tenant: tenantRows[0], settings: settingsRows[0] };
}

// Fetch quote + payment link details for the public payment page — no auth, gated only by the (random, unguessable) token.
router.get("/public/pay/:token", paymentLinkRateLimiter, async (req, res) => {
  try {
    const ctx = await loadPaymentLinkContext(req.params.token as string);
    if (!ctx) { res.status(404).json({ error: "Payment link not found" }); return; }

    const items = ctx.quote
      ? await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, ctx.quote.id)).orderBy(asc(quoteItemsTable.sortOrder))
      : [];

    res.json({
      tenant: { name: ctx.tenant?.name ?? "" },
      settings: {
        squareApplicationId: ctx.settings?.squareApplicationId ?? null,
        squareLocationId: ctx.settings?.squareLocationId ?? null,
        squareEnvironment: ctx.settings?.squareEnvironment ?? "sandbox",
        // True only when the FULL Square config exists server-side — including the secret access
        // token, which the charge needs but is never exposed here. Without this flag the card form
        // renders on app-id/location-id alone and every Pay attempt 400s ("not configured").
        paymentsReady: !!buildSquareConfig(ctx.settings as any),
        primaryColor: ctx.settings?.primaryColor ?? null,
      },
      quote: ctx.quote ? {
        reference: ctx.quote.reference,
        status: ctx.quote.status,
        subtotal: ctx.quote.subtotal,
        vatAmount: ctx.quote.vatAmount,
        total: ctx.quote.total,
        items,
      } : null,
      paymentLink: {
        amount: ctx.link.amount,
        currency: ctx.link.currency,
        status: ctx.link.status,
        customerName: ctx.link.customerName,
      },
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Charge a Square card nonce against a payment link. The amount charged always comes from the
// stored payment_links row — never from the request body — so a tampered client can never pay
// a different amount than what was actually requested.
router.post("/public/pay/:token/charge", paymentLinkRateLimiter, async (req, res) => {
  try {
    const sourceId = req.body?.sourceId;
    if (!sourceId || typeof sourceId !== "string") { res.status(400).json({ error: "sourceId required" }); return; }

    const linkRows = await db.select().from(paymentLinksTable).where(eq(paymentLinksTable.token, req.params.token as string)).limit(1);
    const link = linkRows[0];
    if (!link) { res.status(404).json({ error: "Payment link not found" }); return; }
    if (link.status !== "Pending") { res.status(409).json({ error: `Payment link is ${link.status.toLowerCase()}` }); return; }

    const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, link.tenantId)).limit(1);
    const creds = buildSquareConfig(settingsRows[0] as any);
    if (!creds) { res.status(400).json({ error: "Payments are not configured for this business" }); return; }

    try {
      const result = await createSquarePayment({
        sourceId,
        amount: Number(link.amount),
        currency: link.currency,
        idempotencyKey: link.idempotencyKey,
        creds,
      });

      await db.update(paymentLinksTable)
        .set({ status: "Paid", paidAt: new Date(), squarePaymentId: result.paymentId })
        .where(eq(paymentLinksTable.id, link.id));

      let quoteStatus = "Paid";
      let quote: typeof quotesTable.$inferSelect | undefined;
      if (link.quoteId) {
        const quoteRows = await db.update(quotesTable).set({ status: "Accepted" }).where(eq(quotesTable.id, link.quoteId)).returning();
        quote = quoteRows[0];
        quoteStatus = quote?.status ?? "Accepted";
      }

      res.json({ status: "Paid", quoteStatus });

      if (quote) {
        // Paid in full → they're a customer now (best-effort, never block the payment response).
        ensureCustomerForQuote(quote.id).catch(e => req.log.error({ err: e }, "ensureCustomerForQuote failed after payment"));
        const recipient = await resolveQuoteRecipient(quote);
        fireNotification({
          tenantId: link.tenantId,
          event: "payment_received",
          ...recipient,
          reference: quote.reference,
          amount: `${link.currency} ${Number(link.amount).toFixed(2)}`,
        });
      } else if (link.customerEmail || link.customerPhone) {
        // Standalone (no-quote) link paid → still capture the payer as a customer.
        upsertCustomer(link.tenantId, {
          ...splitName(link.customerName),
          email: link.customerEmail, phone: link.customerPhone, address: link.customerAddress,
        }).catch(e => req.log.error({ err: e }, "upsertCustomer failed for standalone payment"));
        fireNotification({
          tenantId: link.tenantId,
          event: "payment_received",
          firstName: link.customerName ?? undefined,
          customerEmail: link.customerEmail ?? undefined,
          customerPhone: link.customerPhone ?? undefined,
          amount: `${link.currency} ${Number(link.amount).toFixed(2)}`,
        });
      }
    } catch (chargeErr) {
      const message = chargeErr instanceof SquarePaymentError ? chargeErr.message : "Payment failed";
      req.log.error(chargeErr, "Square charge failed");
      await db.update(paymentLinksTable).set({ status: "Failed", failureReason: message }).where(eq(paymentLinksTable.id, link.id));
      res.json({ status: "Failed", quoteStatus: "Sent", error: message });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Accept or decline a quote from the public payment page, independent of paying — idempotent so a
// double-click or a reopened email link never produces a confusing error. Only meaningful for
// quote-linked payment links — standalone links have no quote to accept/decline.
router.post("/public/pay/:token/action", paymentLinkRateLimiter, async (req, res) => {
  try {
    const action = req.body?.action;
    if (action !== "accept" && action !== "decline") { res.status(400).json({ error: "action must be 'accept' or 'decline'" }); return; }

    const linkRows = await db.select().from(paymentLinksTable).where(eq(paymentLinksTable.token, req.params.token as string)).limit(1);
    const link = linkRows[0];
    if (!link) { res.status(404).json({ error: "Payment link not found" }); return; }
    if (!link.quoteId) { res.status(400).json({ error: "This payment link has no associated quote" }); return; }

    const quoteRows = await db.select().from(quotesTable).where(eq(quotesTable.id, link.quoteId)).limit(1);
    const quote = quoteRows[0];
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }

    if (quote.status === "Accepted" || quote.status === "Rejected") {
      res.json({ status: quote.status });
      return;
    }

    const newStatus = action === "accept" ? "Accepted" : "Rejected";
    await db.update(quotesTable).set({ status: newStatus }).where(eq(quotesTable.id, quote.id));
    res.json({ status: newStatus });

    if (newStatus === "Accepted") {
      ensureCustomerForQuote(quote.id).catch(e => req.log.error({ err: e }, "ensureCustomerForQuote failed after public accept"));
      const recipient = await resolveQuoteRecipient(quote);
      fireNotification({ tenantId: quote.tenantId, event: "quote_accepted", ...recipient, reference: quote.reference });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
