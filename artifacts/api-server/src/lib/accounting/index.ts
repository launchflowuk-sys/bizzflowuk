import {
  db, accountingConnectionsTable, invoicesTable, invoiceItemsTable, customersTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logger } from "../logger";
import { AccountingError, providerConfigured, type AccountingCredentials, type AccountingProvider, type OutboundInvoice } from "./types";
import { xero } from "./providers/xero";
import { freeagent } from "./providers/freeagent";

/**
 * The accounting link.
 *
 * Assembly and the shared lifecycle: which providers exist, refreshing a token
 * before it is used, pushing an invoice, and writing down what happened either
 * way. The providers themselves know nothing about our schema.
 */

export { AccountingError, providerConfigured } from "./types";
export type { AccountingProvider, OutboundInvoice } from "./types";

const ALL: AccountingProvider[] = [xero, freeagent];
const REGISTRY = new Map(ALL.map(p => [p.key, p]));

export function getAccountingProvider(key: string): AccountingProvider | null {
  return REGISTRY.get(key) ?? null;
}

/**
 * What the dashboard shows.
 *
 * `configured` is the load-bearing field. A provider whose app registration is
 * missing must say so rather than offering a Connect button that dead-ends on
 * somebody else's error page — the failure mode this whole codebase keeps
 * running into is a control that looks live and is not.
 */
export function describeAccountingProviders() {
  return ALL.map(p => ({
    key: p.key,
    label: p.label,
    description: p.description,
    configured: providerConfigured(p),
  }));
}

/**
 * A usable access token, refreshing first if it is about to expire.
 *
 * Returns null when the tenant has to reconnect, having already recorded that
 * on the connection — so every caller can treat null as "not now" without
 * each of them remembering to write the same status.
 */
export async function usableCredentials(connectionId: number): Promise<{
  provider: AccountingProvider;
  credentials: AccountingCredentials;
} | null> {
  const [conn] = await db.select().from(accountingConnectionsTable)
    .where(eq(accountingConnectionsTable.id, connectionId)).limit(1);
  if (!conn || conn.status === "disconnected") return null;

  const provider = getAccountingProvider(conn.provider);
  if (!provider) return null;

  const credentials: AccountingCredentials = {
    accessToken: conn.accessToken ?? "",
    refreshToken: conn.refreshToken,
    expiresAt: conn.expiresAt,
    organisationId: conn.organisationId,
    organisationName: conn.organisationName,
  };

  // A minute of headroom: a token that expires mid-flight fails in a way that
  // looks like a permissions problem and sends people hunting in the wrong place.
  const stale = !credentials.accessToken
    || (credentials.expiresAt ? credentials.expiresAt.getTime() < Date.now() + 60_000 : false);

  if (!stale) return { provider, credentials };

  if (!credentials.refreshToken) {
    await markNeedsReauth(conn.id, "The connection has no refresh token, so it cannot renew itself.");
    return null;
  }

  try {
    const fresh = await provider.refresh(credentials.refreshToken);
    if (!fresh) {
      await markNeedsReauth(conn.id, `${provider.label} needs you to sign in again.`);
      return null;
    }
    await db.update(accountingConnectionsTable).set({
      accessToken: fresh.accessToken,
      // A rotated refresh token MUST be stored. Several providers invalidate
      // the old one on use, so keeping the previous value means the next
      // refresh fails and the tenant is asked to reconnect for no reason.
      refreshToken: fresh.refreshToken ?? credentials.refreshToken,
      expiresAt: fresh.expiresAt,
      organisationId: fresh.organisationId ?? conn.organisationId,
      organisationName: fresh.organisationName ?? conn.organisationName,
      status: "connected",
      lastError: null,
      lastErrorAt: null,
    }).where(eq(accountingConnectionsTable.id, conn.id));
    return { provider, credentials: { ...fresh, refreshToken: fresh.refreshToken ?? credentials.refreshToken } };
  } catch (err: any) {
    const message = err instanceof AccountingError ? err.message : "Could not renew the connection.";
    if (err instanceof AccountingError && err.needsReauth) {
      await markNeedsReauth(conn.id, message);
      return null;
    }
    await noteError(conn.id, message);
    throw err;
  }
}

async function markNeedsReauth(id: number, reason: string) {
  await db.update(accountingConnectionsTable)
    .set({ status: "needs_reauth", lastError: reason, lastErrorAt: new Date() })
    .where(eq(accountingConnectionsTable.id, id));
}

async function noteError(id: number, reason: string) {
  await db.update(accountingConnectionsTable)
    .set({ lastError: reason.slice(0, 600), lastErrorAt: new Date() })
    .where(eq(accountingConnectionsTable.id, id));
}

/** The tenant's live connection, if they have one. */
export async function tenantConnection(tenantId: number) {
  const [conn] = await db.select().from(accountingConnectionsTable).where(and(
    eq(accountingConnectionsTable.tenantId, tenantId),
    sql`${accountingConnectionsTable.status} <> 'disconnected'`,
  )).limit(1);
  return conn ?? null;
}

/** Our invoice, flattened into the shape a provider takes. */
async function outbound(invoiceId: number): Promise<OutboundInvoice | null> {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!inv) return null;

  const lines = await db.select().from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, invoiceId))
    .orderBy(invoiceItemsTable.sortOrder);

  let customer: OutboundInvoice["customer"] = null;
  if (inv.customerId) {
    const [c] = await db.select().from(customersTable).where(eq(customersTable.id, inv.customerId)).limit(1);
    if (c) {
      customer = {
        externalId: c.accountingExternalId ?? null,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || `Customer ${c.id}`,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        city: c.city ?? null,
        postcode: c.postcode ?? null,
      };
    }
  }

  return {
    reference: inv.reference,
    issuedOn: inv.issuedOn,
    dueOn: inv.dueOn,
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    total: inv.total,
    notes: inv.notes,
    lines: lines.map(l => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
      total: l.total,
    })),
    customer,
    // Filled in by syncInvoice, which is the only place that knows which
    // connection this is going to.
    salesAccountCode: null,
  };
}

/**
 * The tenant's chosen sales nominal, if they set one.
 *
 * Lives in the connection's `settings` jsonb rather than a column of its own
 * because it means nothing outside the provider it belongs to: Xero calls it an
 * account code, FreeAgent calls it a category, and the next one will call it
 * something else again.
 */
export function salesAccountCodeOf(conn: { settings?: Record<string, unknown> | null }): string | null {
  const raw = conn?.settings?.["salesAccountCode"];
  const code = typeof raw === "string" ? raw.trim() : "";
  return code || null;
}

export type SyncOutcome =
  | { ok: true; externalId: string; alreadySent?: boolean }
  | { ok: false; reason: string; needsReauth?: boolean };

/**
 * Send one invoice to the tenant's accounting package.
 *
 * Idempotent on `accountingExternalId`: an invoice that has already gone is
 * reported as sent rather than pushed again. Double-posting into somebody's
 * accounts is the one failure here that costs them real money to unpick.
 */
export async function syncInvoice(invoiceId: number, tenantId: number): Promise<SyncOutcome> {
  const [inv] = await db.select().from(invoicesTable).where(and(
    eq(invoicesTable.id, invoiceId),
    eq(invoicesTable.tenantId, tenantId),
  )).limit(1);
  if (!inv) return { ok: false, reason: "That invoice does not exist." };

  if (inv.accountingExternalId) {
    return { ok: true, externalId: inv.accountingExternalId, alreadySent: true };
  }
  if (inv.status === "draft") {
    return { ok: false, reason: "Send the invoice first — a draft has nothing to post." };
  }

  const conn = await tenantConnection(tenantId);
  if (!conn) return { ok: false, reason: "No accounting package is connected." };

  const usable = await usableCredentials(conn.id);
  if (!usable) {
    return { ok: false, reason: `${conn.provider} needs reconnecting.`, needsReauth: true };
  }

  const payload = await outbound(invoiceId);
  if (!payload) return { ok: false, reason: "That invoice does not exist." };
  if (!payload.lines.length) return { ok: false, reason: "The invoice has no lines on it." };
  payload.salesAccountCode = salesAccountCodeOf(conn);

  try {
    const result = await usable.provider.pushInvoice({ credentials: usable.credentials, invoice: payload });

    await db.update(invoicesTable).set({
      accountingProvider: usable.provider.key,
      accountingExternalId: result.externalId,
      accountingSyncedAt: new Date(),
      accountingError: null,
    }).where(eq(invoicesTable.id, invoiceId));

    // Remember the contact so the next invoice reuses it instead of creating a
    // second near-identical customer in their accounts.
    if (result.customerExternalId && inv.customerId) {
      await db.update(customersTable)
        .set({ accountingExternalId: result.customerExternalId })
        .where(and(eq(customersTable.id, inv.customerId), isNull(customersTable.accountingExternalId)));
    }

    await db.update(accountingConnectionsTable)
      .set({ lastSyncAt: new Date(), lastError: null, lastErrorAt: null })
      .where(eq(accountingConnectionsTable.id, conn.id));

    logger.info({ tenantId, invoiceId, provider: usable.provider.key }, "Invoice sent to accounting");
    return { ok: true, externalId: result.externalId };
  } catch (err: any) {
    const reason = err instanceof AccountingError ? err.message : "The invoice could not be sent.";
    // Written onto the INVOICE, not just the log. A trade should find out from
    // the invoice that it never reached their accounts, not at the year end.
    await db.update(invoicesTable)
      .set({ accountingError: reason.slice(0, 600) })
      .where(eq(invoicesTable.id, invoiceId));
    await noteError(conn.id, reason);
    if (err instanceof AccountingError && err.needsReauth) await markNeedsReauth(conn.id, reason);
    logger.error({ err, tenantId, invoiceId }, "Invoice could not be sent to accounting");
    return { ok: false, reason, needsReauth: err instanceof AccountingError ? err.needsReauth : false };
  }
}
