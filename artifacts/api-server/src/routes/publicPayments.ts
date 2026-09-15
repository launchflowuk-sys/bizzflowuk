import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLinksTable, quotesTable, quoteItemsTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { paymentLinkRateLimiter } from "../middlewares/rateLimit";
import { buildSquareConfig, buildStripeConfig, resolvePaymentProvider } from "../lib/settingsHelpers";
import { createSquarePayment, SquarePaymentError } from "../lib/square";
import { assertIntentPaid, createStripePaymentIntent, retrieveStripePaymentIntent, StripePaymentError } from "../lib/stripe";
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

    // Name only — resolveQuoteRecipient also returns email/phone, which must not be echoed back
    // on a page reachable by anyone holding the link.
    const recipient = ctx.quote ? await resolveQuoteRecipient(ctx.quote) : {};

    res.json({
      tenant: { name: ctx.tenant?.name ?? "" },
      settings: {
        squareApplicationId: ctx.settings?.squareApplicationId ?? null,
        squareLocationId: ctx.settings?.squareLocationId ?? null,
        squareEnvironment: ctx.settings?.squareEnvironment ?? "sandbox",
        // Stripe's publishable key is meant to be public — it is what the
        // browser needs to render the card field. The SECRET key never appears
        // here or anywhere else client-facing.
        stripePublishableKey: buildStripeConfig(ctx.settings as any)?.publishableKey ?? null,
        // Which till this page should draw. Null means the business has not
        // finished setting either one up.
        paymentProvider: resolvePaymentProvider(ctx.settings as any),
        // True only when a FULL provider config exists server-side — including
        // the secret half, which the charge needs but is never exposed here.
        // Without this flag the card form renders on the public ids alone and
        // every Pay attempt 400s ("not configured").
        paymentsReady: !!resolvePaymentProvider(ctx.settings as any),
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
        // `customerName` is only ever set on standalone links, typed in at creation. For a
        // quote-linked payment — the normal path — the name lives on the linked lead or customer,
        // so resolve it here rather than leaving the page with nothing to greet them by.
        customerName: ctx.link.customerName || [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || null,
        customerFirstName: ctx.link.customerName?.split(/\s+/)[0] || recipient.firstName || null,
      },
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Everything that happens once money has actually arrived.
 *
 * Shared by both tills on purpose. Marking the link paid, accepting the quote,
 * creating the customer and firing the notification is the part that must not
 * drift between providers — and writing it twice is exactly how it would.
 *
 * The side effects are best-effort and deliberately never block the response:
 * the money has already moved, and a failed notification email is not a failed
 * payment.
 */
async function settlePayment(
  req: any,
  link: typeof paymentLinksTable.$inferSelect,
  paid: { provider: "square" | "stripe"; squarePaymentId?: string; stripePaymentIntentId?: string },
) {
  await db.update(paymentLinksTable)
    .set({
      status: "Paid",
      paidAt: new Date(),
      paymentProvider: paid.provider,
      ...(paid.squarePaymentId ? { squarePaymentId: paid.squarePaymentId } : {}),
      ...(paid.stripePaymentIntentId ? { stripePaymentIntentId: paid.stripePaymentIntentId } : {}),
    })
    .where(eq(paymentLinksTable.id, link.id));

  let quoteStatus = "Paid";
  let quote: typeof quotesTable.$inferSelect | undefined;
  if (link.quoteId) {
    const quoteRows = await db.update(quotesTable).set({ status: "Accepted" }).where(eq(quotesTable.id, link.quoteId)).returning();
    quote = quoteRows[0];
    quoteStatus = quote?.status ?? "Accepted";
  }

  if (quote) {
    // Paid in full → they're a customer now.
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

  return { quoteStatus };
}

/** A payment link plus its tenant's settings, or null when the token is unknown. */
async function loadPayableLink(token: string) {
  const linkRows = await db.select().from(paymentLinksTable).where(eq(paymentLinksTable.token, token)).limit(1);
  const link = linkRows[0];
  if (!link) return null;
  const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, link.tenantId)).limit(1);
  return { link, settings: settingsRows[0] };
}

/**
 * Stripe, step one: create the PaymentIntent the browser will confirm.
 *
 * The amount comes from the stored payment_links row, never the request body,
 * so the figure Stripe is told to collect is the figure the business set. The
 * link's own idempotency key is reused, so a double-tap on Pay returns the same
 * intent instead of opening a second one and risking a double charge.
 *
 * Only the client secret goes back — it is scoped to this one intent and is
 * meant to reach the browser. The account's secret key never leaves here.
 */
router.post("/public/pay/:token/stripe-intent", paymentLinkRateLimiter, async (req: any, res) => {
  try {
    const ctx = await loadPayableLink(req.params.token as string);
    if (!ctx) { res.status(404).json({ error: "Payment link not found" }); return; }
    if (ctx.link.status !== "Pending") { res.status(409).json({ error: `Payment link is ${ctx.link.status.toLowerCase()}` }); return; }

    const creds = buildStripeConfig(ctx.settings as any);
    if (!creds) { res.status(400).json({ error: "Card payments are not configured for this business" }); return; }

    const intent = await createStripePaymentIntent({
      amount: Number(ctx.link.amount),
      currency: ctx.link.currency,
      idempotencyKey: ctx.link.idempotencyKey,
      creds,
      description: `Payment link ${ctx.link.token}`,
      metadata: { paymentLinkId: String(ctx.link.id), tenantId: String(ctx.link.tenantId) },
    });

    await db.update(paymentLinksTable)
      .set({ stripePaymentIntentId: intent.id, paymentProvider: "stripe" })
      .where(eq(paymentLinksTable.id, ctx.link.id));

    res.json({ clientSecret: intent.clientSecret, publishableKey: creds.publishableKey });
  } catch (err) {
    const message = err instanceof StripePaymentError ? err.message : "Could not start the payment";
    req.log.error(err, "Stripe intent creation failed");
    res.status(502).json({ error: message });
  }
});

// Take the payment. The amount always comes from the stored payment_links row —
// never from the request body — so a tampered client can never pay a different
// amount than the one that was actually requested.
router.post("/public/pay/:token/charge", paymentLinkRateLimiter, async (req: any, res) => {
  try {
    const ctx = await loadPayableLink(req.params.token as string);
    if (!ctx) { res.status(404).json({ error: "Payment link not found" }); return; }
    const { link, settings } = ctx;
    if (link.status !== "Pending") { res.status(409).json({ error: `Payment link is ${link.status.toLowerCase()}` }); return; }

    const provider = resolvePaymentProvider(settings as any);
    if (!provider) { res.status(400).json({ error: "Payments are not configured for this business" }); return; }

    // ── Stripe ──────────────────────────────────────────────────────────────
    if (provider === "stripe") {
      const stripeCreds = buildStripeConfig(settings as any)!;
      const intentId = req.body?.paymentIntentId;
      if (!intentId || typeof intentId !== "string") { res.status(400).json({ error: "paymentIntentId required" }); return; }

      // The id arrives from the browser, so nothing it claims is trusted. It has
      // to be the intent this link issued, and Stripe's own copy — not the
      // client — decides whether it was paid and for how much.
      if (link.stripePaymentIntentId && link.stripePaymentIntentId !== intentId) {
        req.log.warn({ linkId: link.id }, "Stripe intent id did not match the one issued for this link");
        res.status(400).json({ error: "This payment does not belong to this link" });
        return;
      }

      try {
        const intent = await retrieveStripePaymentIntent(intentId, stripeCreds);
        const problem = assertIntentPaid(intent, { amount: Number(link.amount), currency: link.currency });
        if (problem) {
          req.log.warn({ linkId: link.id, problem }, "Stripe intent rejected");
          await db.update(paymentLinksTable).set({ status: "Failed", failureReason: problem }).where(eq(paymentLinksTable.id, link.id));
          res.json({ status: "Failed", quoteStatus: "Sent", error: problem });
          return;
        }

        const { quoteStatus } = await settlePayment(req, link, { provider: "stripe", stripePaymentIntentId: intent.id });
        res.json({ status: "Paid", quoteStatus });
      } catch (chargeErr) {
        const message = chargeErr instanceof StripePaymentError ? chargeErr.message : "Payment failed";
        req.log.error(chargeErr, "Stripe charge verification failed");
        await db.update(paymentLinksTable).set({ status: "Failed", failureReason: message }).where(eq(paymentLinksTable.id, link.id));
        res.json({ status: "Failed", quoteStatus: "Sent", error: message });
      }
      return;
    }

    // ── Square ──────────────────────────────────────────────────────────────
    const sourceId = req.body?.sourceId;
    if (!sourceId || typeof sourceId !== "string") { res.status(400).json({ error: "sourceId required" }); return; }

    const creds = buildSquareConfig(settings as any);
    if (!creds) { res.status(400).json({ error: "Payments are not configured for this business" }); return; }

    try {
      const result = await createSquarePayment({
        sourceId,
        amount: Number(link.amount),
        currency: link.currency,
        idempotencyKey: link.idempotencyKey,
        creds,
      });

      const { quoteStatus } = await settlePayment(req, link, { provider: "square", squarePaymentId: result.paymentId });
      res.json({ status: "Paid", quoteStatus });
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
      fireNotification({ tenantId: quote.tenantId, event: "quote_accepted", quoteId: quote.id, ...recipient, reference: quote.reference });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
