import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  db, accountingConnectionsTable, invoicesTable, invoicePaymentsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { usableCredentials } from "./index";

/**
 * Xero telling us an invoice changed.
 *
 * WHY THIS IS WORTH HAVING, because it is the one thing that walks back the
 * "we only ever push" rule:
 *
 * Brandon reconciles a payment in Xero off his bank feed. Nothing tells us, so
 * we still believe the invoice is outstanding — and the chase automation
 * emails his customer demanding money they have already paid. That is not a
 * glitch, it is Brandon looking unprofessional to his own customer because of
 * us. It is the worst failure this product has available to it.
 *
 * This is deliberately NOT the two-way sync warned about elsewhere. That mess
 * is two systems editing invoice CONTENT and arguing about who wins. This
 * takes one fact in one direction: how much has been paid.
 *
 * THE SIGNATURE CHECK IS NOT OPTIONAL. Without it, anyone who finds this URL
 * can post "invoice paid" for any invoice, and we would silently stop chasing
 * real money. That is a way to lose a trade thousands without anything
 * appearing to go wrong.
 */

/** Xero disables a webhook that does not answer quickly. Reply first, work after. */
const XERO_EVENT_CATEGORY = "INVOICE";

type XeroEvent = {
  resourceId?: string;
  eventType?: string;
  eventCategory?: string;
  tenantId?: string;
};

/**
 * Verify Xero's HMAC over the exact bytes they sent.
 *
 * Returns false rather than throwing so the caller can answer 401 — see the
 * note on the handler about why the status code specifically matters.
 */
function signatureValid(rawBody: Buffer, header: string | undefined): boolean {
  const key = process.env["XERO_WEBHOOK_KEY"];
  if (!key || !header) return false;

  const expected = createHmac("sha256", key).update(rawBody).digest("base64");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown comparison is a 500 where we need a 401.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Bring one invoice's payment state into line with Xero's.
 *
 * Records the DIFFERENCE rather than setting a total, which makes repeated
 * deliveries harmless: a second event for an unchanged invoice computes a
 * delta of zero and writes nothing. Xero retries, and retries must not each
 * add a payment.
 */
async function reconcileInvoice(tenantId: number, xeroInvoiceId: string): Promise<void> {
  const [inv] = await db.select().from(invoicesTable).where(and(
    eq(invoicesTable.tenantId, tenantId),
    eq(invoicesTable.accountingExternalId, xeroInvoiceId),
  )).limit(1);

  // An invoice we did not push. Brandon raising something directly in Xero is
  // his business, not ours to import.
  if (!inv) return;

  const [conn] = await db.select().from(accountingConnectionsTable).where(and(
    eq(accountingConnectionsTable.tenantId, tenantId),
    eq(accountingConnectionsTable.provider, "xero"),
  )).limit(1);
  if (!conn) return;

  const usable = await usableCredentials(conn.id);
  if (!usable) return;

  /**
   * The webhook says WHAT changed, never HOW. Xero's payload carries the id
   * and nothing else, so the current state has to be fetched.
   */
  const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoiceId}`, {
    headers: {
      authorization: `Bearer ${usable.credentials.accessToken}`,
      "xero-tenant-id": usable.credentials.organisationId ?? "",
      accept: "application/json",
    },
  });
  if (!res.ok) {
    logger.warn({ tenantId, xeroInvoiceId, status: res.status }, "Could not read the invoice back from Xero");
    return;
  }

  const remote = (await res.json() as any)?.Invoices?.[0];
  if (!remote) return;

  const remotePaid = Number(remote.AmountPaid ?? 0);
  const localPaid = Number(inv.amountPaid ?? 0);
  const delta = Math.round((remotePaid - localPaid) * 100) / 100;

  // Only ever forward. A refund or a correction in Xero is a decision with
  // consequences here — it could un-pay an invoice and restart the chase — and
  // that belongs to a person, not to a webhook.
  if (delta <= 0) return;

  await db.insert(invoicePaymentsTable).values({
    invoiceId: inv.id,
    amount: delta.toFixed(2),
    paidOn: new Date().toISOString().slice(0, 10),
    method: "bank_transfer",
    reference: "Xero",
    notes: "Recorded automatically from Xero.",
  });

  // recalc lives on the invoices route and owns the arithmetic and the status
  // rules. Duplicating either here is how two places start disagreeing about
  // whether something is paid.
  const { recalc } = await import("../../routes/invoices");
  await recalc(inv.id, tenantId);

  logger.info({ tenantId, invoiceId: inv.id, delta }, "Payment picked up from Xero");
}

/**
 * The endpoint itself.
 *
 * Mounted before express.json() with a raw body parser, the same as Stripe's:
 * the signature is over the exact bytes sent, and a parse-then-restringify
 * changes key order and whitespace so it never verifies again.
 */
export async function handleXeroWebhook(req: Request, res: Response): Promise<void> {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

  /**
   * 401, specifically, on a bad signature.
   *
   * This is not a style choice. Xero validates a new webhook by deliberately
   * sending a payload with a WRONG signature and checking we answer 401. A 400
   * or a 500 fails their check and the webhook is switched off — so the
   * obvious "bad request" reading of this would quietly break the feature at
   * setup time.
   */
  if (!signatureValid(raw, req.header("x-xero-signature"))) {
    res.status(401).end();
    return;
  }

  // Answer before doing any work. Xero expects a reply within seconds and
  // retries anything slower, which would mean processing the same events twice.
  res.status(200).end();

  try {
    const payload = JSON.parse(raw.toString("utf8") || "{}");
    const events: XeroEvent[] = Array.isArray(payload?.events) ? payload.events : [];

    for (const event of events) {
      if (event.eventCategory !== XERO_EVENT_CATEGORY) continue;
      if (!event.resourceId || !event.tenantId) continue;

      /**
       * Which of OUR tenants this belongs to.
       *
       * The Xero organisation id in the event is matched against a live
       * connection. This is the security boundary as much as the lookup: an
       * event naming an organisation nobody here has connected is ignored,
       * so a valid signature alone cannot reach a business that never linked.
       */
      const [conn] = await db.select({ tenantId: accountingConnectionsTable.tenantId })
        .from(accountingConnectionsTable).where(and(
          eq(accountingConnectionsTable.provider, "xero"),
          eq(accountingConnectionsTable.organisationId, event.tenantId),
          sql`${accountingConnectionsTable.status} <> 'disconnected'`,
        )).limit(1);
      if (!conn) continue;

      await reconcileInvoice(conn.tenantId, event.resourceId);
    }
  } catch (err) {
    // The response has already gone. Logging is all that is left, and losing
    // an event is survivable — the next change to that invoice brings another.
    logger.error({ err }, "Xero webhook processing failed");
  }
}
