import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { logger } from "../lib/logger";

/**
 * BizzFlowUK's own subscription: £99/month with seven days free.
 *
 * Two Stripe accounts are in play in this codebase and they must never meet:
 *
 *   - The TENANT's account (tenant_settings.stripe_*) takes money from THEIR
 *     customers, through a payment link.
 *   - The PLATFORM's account (the env vars below) takes money from the tenant,
 *     for using BizzFlowUK.
 *
 * This file only ever touches the second. A tenant's key can never be used to
 * charge a subscription, and the platform key is never handed to a tenant page.
 *
 * Stripe Checkout rather than a card form of our own: the trial, VAT handling,
 * SCA, retries, dunning and the "update your card" page all come with it, and
 * none of that is worth rebuilding to own the styling of one screen.
 */

const router = Router();

/** The platform's own Stripe credentials. All three come from the environment. */
function platformStripe() {
  const secretKey = process.env.PLATFORM_STRIPE_SECRET_KEY;
  const priceId = process.env.PLATFORM_STRIPE_PRICE_ID;
  if (!secretKey || !priceId) return null;
  return { secretKey, priceId };
}

const TRIAL_DAYS = 7;
const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2024-06-20";

async function stripeCall(path: string, secretKey: string, body?: Record<string, string>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as any)?.error?.message || `Stripe request failed (${res.status})`;
    throw new Error(message);
  }
  return data as any;
}

/**
 * Where the tenant stands: trialing, paying, or never started.
 *
 * Read from our own row rather than called through to Stripe on every page
 * load — the webhook keeps it current, and a dashboard that cannot render
 * because Stripe is slow is a worse product than one showing a status that is
 * a few seconds stale.
 */
router.get("/billing/status", requireTenantAccess, async (req: any, res) => {
  try {
    const [tenant] = await db.select({
      plan: tenantsTable.plan,
      status: tenantsTable.billingStatus,
      trialEndsAt: tenantsTable.trialEndsAt,
      websiteDeliveredAt: tenantsTable.websiteDeliveredAt,
      subscriptionId: tenantsTable.billingSubscriptionId,
    }).from(tenantsTable).where(eq(tenantsTable.id, req.authUser?.tenantId ?? -1)).limit(1);

    if (!tenant) { res.status(404).json({ error: "Not found" }); return; }

    const trialEndsAt = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
      : null;

    res.json({
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      trialDaysLeft: daysLeft,
      websiteDeliveredAt: tenant.websiteDeliveredAt,
      subscribed: !!tenant.subscriptionId,
      priceMonthlyGbp: 99,
      configured: !!platformStripe(),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Start the subscription. Returns a Stripe Checkout URL to send the owner to.
 *
 * Idempotent on the customer: a tenant gets one Stripe customer for its whole
 * life, so cancelling and resubscribing keeps one billing history rather than
 * scattering invoices across duplicate customers.
 */
router.post("/billing/checkout", requireTenantAccess, async (req: any, res) => {
  try {
    const creds = platformStripe();
    if (!creds) {
      res.status(503).json({ error: "Billing is not configured yet. Please contact us." });
      return;
    }

    const tenantId = req.authUser?.tenantId ?? -1;
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    if (!tenant) { res.status(404).json({ error: "Not found" }); return; }

    if (tenant.billingSubscriptionId) {
      res.status(409).json({ error: "This business already has a subscription." });
      return;
    }

    const [owner] = await db.select({ email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, req.authUser.id)).limit(1);

    let customerId = tenant.billingCustomerId;
    if (!customerId) {
      const customer = await stripeCall("/customers", creds.secretKey, {
        email: owner?.email ?? tenant.email ?? "",
        name: tenant.name,
        "metadata[tenantId]": String(tenant.id),
        "metadata[slug]": tenant.slug,
      });
      customerId = customer.id;
      await db.update(tenantsTable).set({ billingCustomerId: customerId }).where(eq(tenantsTable.id, tenantId));
    }

    const base = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";
    const session = await stripeCall("/checkout/sessions", creds.secretKey, {
      mode: "subscription",
      customer: customerId!,
      "line_items[0][price]": creds.priceId,
      "line_items[0][quantity]": "1",
      "subscription_data[trial_period_days]": String(TRIAL_DAYS),
      // Stripe attaches this to the subscription, so the webhook can find the
      // tenant without trusting anything the browser sends back.
      "subscription_data[metadata][tenantId]": String(tenant.id),
      success_url: `${base}/dashboard?subscribed=1`,
      cancel_url: `${base}/dashboard`,
      allow_promotion_codes: "true",
    });

    res.json({ url: session.url });
  } catch (err: any) {
    req.log.error(err, "Stripe checkout session failed");
    res.status(502).json({ error: err?.message || "Could not start checkout" });
  }
});

/**
 * A link to Stripe's own billing portal, where the owner can change their card,
 * see invoices or cancel.
 *
 * Cancelling is deliberately somewhere obvious rather than behind an email to
 * us. A subscription that is hard to leave is one people resent paying for.
 */
router.post("/billing/portal", requireTenantAccess, async (req: any, res) => {
  try {
    const creds = platformStripe();
    if (!creds) { res.status(503).json({ error: "Billing is not configured yet." }); return; }

    const [tenant] = await db.select({ customerId: tenantsTable.billingCustomerId })
      .from(tenantsTable).where(eq(tenantsTable.id, req.authUser?.tenantId ?? -1)).limit(1);
    if (!tenant?.customerId) { res.status(409).json({ error: "No subscription to manage yet." }); return; }

    const base = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";
    const portal = await stripeCall("/billing_portal/sessions", creds.secretKey, {
      customer: tenant.customerId,
      return_url: `${base}/dashboard`,
    });
    res.json({ url: portal.url });
  } catch (err: any) {
    req.log.error(err, "Stripe billing portal failed");
    res.status(502).json({ error: err?.message || "Could not open the billing portal" });
  }
});

/**
 * Stripe's webhook: the only thing that changes billing status.
 *
 * The browser is never believed about whether somebody paid — it comes back
 * from Checkout with a success URL that anyone could type. Stripe tells us, and
 * the signature proves it was Stripe.
 *
 * Mounted with a raw body parser (see index.ts): the signature is computed over
 * the exact bytes, so a JSON-parsed-and-restringified body never verifies.
 */
export async function handleStripeWebhook(req: any, res: any) {
  const secret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET;
  const creds = platformStripe();
  if (!secret || !creds) { res.status(503).send("billing not configured"); return; }

  const signature = req.get("stripe-signature");
  const raw: Buffer = req.body;
  if (!signature || !Buffer.isBuffer(raw)) { res.status(400).send("bad request"); return; }

  let event: any;
  try {
    event = verifyStripeSignature(raw, signature, secret);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stripe webhook signature rejected");
    res.status(400).send("invalid signature");
    return;
  }

  try {
    const object = event?.data?.object ?? {};
    const tenantId = Number(object?.metadata?.tenantId);

    if (event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted") {
      // Prefer the id we stored; fall back to the metadata Stripe carries.
      const [byId] = object.id
        ? await db.select({ id: tenantsTable.id }).from(tenantsTable)
            .where(eq(tenantsTable.billingSubscriptionId, object.id)).limit(1)
        : [];
      const [byCustomer] = !byId && object.customer
        ? await db.select({ id: tenantsTable.id }).from(tenantsTable)
            .where(eq(tenantsTable.billingCustomerId, object.customer)).limit(1)
        : [];
      const target = byId?.id ?? byCustomer?.id ?? (Number.isFinite(tenantId) ? tenantId : null);

      if (target) {
        const cancelled = event.type === "customer.subscription.deleted";
        await db.update(tenantsTable).set({
          billingSubscriptionId: cancelled ? null : object.id,
          billingStatus: cancelled ? "canceled" : object.status,
          trialEndsAt: object.trial_end ? new Date(object.trial_end * 1000) : null,
          // The plan column is what the rest of the app reads to decide what a
          // tenant may use, so it follows the subscription rather than being
          // set by hand somewhere else.
          plan: cancelled ? "cancelled" : object.status === "trialing" ? "trial" : "standard",
        }).where(eq(tenantsTable.id, target));
        logger.info({ tenantId: target, status: object.status, type: event.type }, "Subscription updated");
      } else {
        logger.warn({ type: event.type, subscription: object.id }, "Subscription event matched no tenant");
      }
    }

    // Always 200 a webhook we understood. Stripe retries anything else, and a
    // retry storm over an event we chose to ignore helps nobody.
    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Stripe webhook handling failed");
    // 500 so Stripe retries — this one we genuinely failed to process.
    res.status(500).send("handler error");
  }
}

/**
 * Verifies Stripe's `t=…,v1=…` signature header.
 *
 * Hand-rolled because pulling in the SDK for one HMAC is not worth the
 * dependency. Constant-time compare, and the timestamp is checked so a captured
 * request cannot be replayed indefinitely.
 */
function verifyStripeSignature(payload: Buffer, header: string, secret: string): any {
  const parts = Object.fromEntries(
    header.split(",").map(p => p.split("=", 2) as [string, string]),
  );
  const timestamp = parts["t"];
  const provided = parts["v1"];
  if (!timestamp || !provided) throw new Error("malformed signature header");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("timestamp outside tolerance");

  const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("signature mismatch");

  return JSON.parse(payload.toString("utf8"));
}

export default router;
