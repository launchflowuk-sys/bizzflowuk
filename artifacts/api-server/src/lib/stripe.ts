/**
 * Stripe, as a second till beside Square.
 *
 * Plain REST rather than the `stripe` SDK, matching how Square is done here:
 * two endpoints are needed and the SDK is a large dependency to carry — and to
 * keep patched — for that. If the integration ever grows refunds, Connect or
 * subscriptions, revisit it.
 *
 * The flow differs from Square's in one important way. Square takes a card
 * nonce and charges it server-side in a single call. Stripe splits it: the
 * server creates a PaymentIntent, the browser confirms it with Stripe.js (so
 * card details and 3-D Secure never touch this server), and the server then
 * *fetches the intent back* to find out what really happened.
 *
 * That last step is the security of the whole thing. The browser telling us
 * "it worked" is not evidence — anyone can post that. Only Stripe's own copy of
 * the intent decides, and `assertIntentPaid` below is what checks it, including
 * the amount, so a tampered client cannot pay £1 against a £4,250 quote.
 */

const STRIPE_API = "https://api.stripe.com/v1";

/** Pinned so Stripe cannot change a response shape under us on their schedule. */
const STRIPE_VERSION = "2024-06-20";

export interface StripeCreds {
  publishableKey: string;
  secretKey: string;
}

export class StripePaymentError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export interface StripePaymentIntent {
  id: string;
  status: string;
  clientSecret: string | null;
  amount: number;
  amountReceived: number;
  currency: string;
}

/** Stripe works in the smallest currency unit — pence for GBP. */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Stripe's API is form-encoded, including nested keys as `a[b]=c`.
 *
 * Hand-rolled rather than pulling in `qs`: the shapes here are shallow and
 * known, and URLSearchParams handles the escaping.
 */
function form(fields: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

async function callStripe(
  path: string,
  secretKey: string,
  init: { method: "GET" | "POST"; body?: string; idempotencyKey?: string },
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_VERSION,
  };
  if (init.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  // Stripe deduplicates on this for 24 hours, so a retried request cannot take
  // the money twice. The caller passes the payment link's own key.
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${STRIPE_API}${path}`, { method: init.method, headers, body: init.body });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (data as any)?.error;
    // Stripe's `message` is written for the payer ("Your card was declined"),
    // so it is safe and useful to surface. Everything else stays in the log.
    throw new StripePaymentError(error?.message || `Stripe request failed (${res.status})`, res.status, error ?? data);
  }
  return data;
}

function toIntent(data: any): StripePaymentIntent {
  return {
    id: data?.id,
    status: data?.status,
    clientSecret: data?.client_secret ?? null,
    amount: Number(data?.amount ?? 0),
    amountReceived: Number(data?.amount_received ?? 0),
    currency: String(data?.currency ?? "").toLowerCase(),
  };
}

/**
 * Creates (or, on a retry, returns) the PaymentIntent for a payment link.
 *
 * The amount comes from the stored payment_links row at the call site — never
 * from a request body — so the figure Stripe is told to collect is the figure
 * the business asked for.
 */
export async function createStripePaymentIntent(opts: {
  amount: number;
  currency: string;
  idempotencyKey: string;
  creds: StripeCreds;
  description?: string;
  /** Surfaced in the Stripe dashboard so a payment can be traced back here. */
  metadata?: Record<string, string>;
}): Promise<StripePaymentIntent> {
  const fields: Record<string, string | number | boolean | undefined> = {
    amount: toMinorUnits(opts.amount),
    currency: opts.currency.toLowerCase(),
    // Lets the tenant enable Apple Pay, Google Pay, Link and so on from their
    // own Stripe dashboard without a code change here.
    "automatic_payment_methods[enabled]": true,
    description: opts.description,
  };
  for (const [k, v] of Object.entries(opts.metadata ?? {})) fields[`metadata[${k}]`] = v;

  const data = await callStripe("/payment_intents", opts.creds.secretKey, {
    method: "POST",
    body: form(fields),
    idempotencyKey: opts.idempotencyKey,
  });
  return toIntent(data);
}

export async function retrieveStripePaymentIntent(id: string, creds: StripeCreds): Promise<StripePaymentIntent> {
  const data = await callStripe(`/payment_intents/${encodeURIComponent(id)}`, creds.secretKey, { method: "GET" });
  return toIntent(data);
}

/**
 * Decides whether a PaymentIntent really paid what it was supposed to.
 *
 * Returns null when everything checks out, or a reason when it does not. The
 * amount and currency are re-checked against the payment link rather than
 * trusted, because the intent id arrives from the browser: without this, a
 * payer could confirm a cheap intent of their own making and post its id here.
 *
 * `amount_received` rather than `amount`: the first is what Stripe actually
 * collected, the second is only what was asked for.
 */
export function assertIntentPaid(
  intent: StripePaymentIntent,
  expected: { amount: number; currency: string },
): string | null {
  if (intent.status !== "succeeded") return `Payment not completed (${intent.status})`;

  const expectedMinor = toMinorUnits(expected.amount);
  if (intent.amountReceived !== expectedMinor) {
    return `Amount mismatch — expected ${expectedMinor}, received ${intent.amountReceived}`;
  }
  if (intent.currency !== expected.currency.toLowerCase()) {
    return `Currency mismatch — expected ${expected.currency.toLowerCase()}, got ${intent.currency}`;
  }
  return null;
}

/**
 * A Stripe key pair is only usable if both halves are present AND agree about
 * which environment they belong to.
 *
 * A live publishable key with a test secret key is a configuration that fails
 * at the worst possible moment — at the till, in front of a customer — so it is
 * rejected up front instead.
 */
export function stripeKeysAgree(publishableKey: string, secretKey: string): boolean {
  const live = (k: string) => k.startsWith("pk_live_") || k.startsWith("sk_live_");
  const test = (k: string) => k.startsWith("pk_test_") || k.startsWith("sk_test_");
  if (live(publishableKey) && live(secretKey)) return true;
  if (test(publishableKey) && test(secretKey)) return true;
  return false;
}
