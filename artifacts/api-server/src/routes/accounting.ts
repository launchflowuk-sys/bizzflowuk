import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, accountingConnectionsTable, invoicesTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import {
  describeAccountingProviders, getAccountingProvider, providerConfigured,
  syncInvoice, tenantConnection,
} from "../lib/accounting";

const router = Router();
function tid(req: any): number { return req.authUser?.tenantId!; }

const BASE = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";
const redirectUri = (provider: string) => `${BASE}/api/accounting/callback/${provider}`;

/**
 * Linking a tenant to their accounting package.
 *
 * The OAuth callback is the awkward part: the provider redirects a BROWSER
 * back to us, so that request carries no Authorization header and cannot be
 * behind requireTenantAccess. Which tenant it belongs to therefore has to
 * travel in the `state` parameter — and state that the client could forge is
 * how you connect your accounts to somebody else's business.
 *
 * So state is signed. It carries the tenant id, the user id and a timestamp,
 * with an HMAC over all three using SESSION_SECRET. The callback verifies the
 * signature and the age before it will touch a token. An attacker who cannot
 * produce a valid signature cannot nominate a tenant.
 */

const STATE_TTL_MS = 15 * 60 * 1000;

function signState(payload: string): string {
  return createHmac("sha256", process.env["SESSION_SECRET"] ?? "").update(payload).digest("hex");
}

function makeState(tenantId: number, userId: number): string {
  const payload = `${tenantId}.${userId}.${Date.now()}`;
  return `${payload}.${signState(payload)}`;
}

function readState(state: string): { tenantId: number; userId: number } | null {
  const parts = String(state).split(".");
  if (parts.length !== 4) return null;
  const [t, u, ts, sig] = parts;
  const expected = signState(`${t}.${u}.${ts}`);
  // Constant-time, so the signature cannot be guessed a character at a time.
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() - Number(ts) > STATE_TTL_MS) return null;
  const tenantId = Number(t), userId = Number(u);
  if (!Number.isInteger(tenantId) || !Number.isInteger(userId)) return null;
  return { tenantId, userId };
}

/** The catalogue, plus whatever this tenant already has connected. */
router.get("/accounting", requireTenantAccess, async (req: any, res) => {
  try {
    const conn = await tenantConnection(tid(req));
    res.json({
      providers: describeAccountingProviders(),
      connection: conn
        ? {
          provider: conn.provider,
          status: conn.status,
          organisationName: conn.organisationName,
          connectedAt: conn.connectedAt,
          lastSyncAt: conn.lastSyncAt,
          lastError: conn.lastError,
        }
        : null,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Where the Connect button goes. Returns the URL rather than redirecting, so
 *  the dashboard can send the browser itself with its own token intact. */
router.post("/accounting/connect/:provider", requireTenantAccess, async (req: any, res) => {
  try {
    const provider = getAccountingProvider(String(req.params.provider));
    if (!provider) { res.status(404).json({ error: "We do not support that one." }); return; }

    // A provider with no app registration cannot be connected. Saying so is
    // the whole point — a Connect button that dead-ends on somebody else's
    // error page is worse than one that is plainly not ready.
    if (!providerConfigured(provider)) {
      res.status(503).json({
        error: `${provider.label} is not switched on for this platform yet. It needs an app registration before anyone can connect to it.`,
      });
      return;
    }

    const state = makeState(tid(req), req.authUser!.id);
    res.json({ url: provider.authorizeUrl({ state, redirectUri: redirectUri(provider.key) }) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Where the provider sends the browser back.
 *
 * Unauthenticated by necessity — see the note at the top about signed state.
 * Always redirects to a page rather than returning JSON, because a person is
 * looking at this, not a script.
 */
router.get("/accounting/callback/:provider", async (req: any, res) => {
  const settingsUrl = `${BASE}/dashboard/settings`;
  const fail = (why: string) =>
    res.redirect(`${settingsUrl}?accounting=error&reason=${encodeURIComponent(why)}`);

  try {
    const provider = getAccountingProvider(String(req.params.provider));
    if (!provider) return fail("Unknown provider");

    // The tenant may simply have pressed Cancel at the provider.
    if (req.query.error) return fail(String(req.query.error_description || req.query.error));

    const parsed = readState(String(req.query.state ?? ""));
    if (!parsed) return fail("That link has expired. Please start again.");

    const code = String(req.query.code ?? "");
    if (!code) return fail("No authorisation code came back.");

    const credentials = await provider.exchangeCode({ code, redirectUri: redirectUri(provider.key) });

    // One row per tenant per provider, enforced by the unique index. Upserting
    // means reconnecting a stale link repairs it in place rather than leaving
    // a dead row beside a live one.
    await db.insert(accountingConnectionsTable).values({
      tenantId: parsed.tenantId,
      provider: provider.key,
      status: "connected",
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
      organisationId: credentials.organisationId,
      organisationName: credentials.organisationName,
      connectedByUserId: parsed.userId,
      lastError: null,
      lastErrorAt: null,
    }).onConflictDoUpdate({
      target: [accountingConnectionsTable.tenantId, accountingConnectionsTable.provider],
      set: {
        status: "connected",
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
        organisationId: credentials.organisationId,
        organisationName: credentials.organisationName,
        connectedByUserId: parsed.userId,
        connectedAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    req.log.warn({ tenantId: parsed.tenantId, provider: provider.key }, "Accounting package connected");
    res.redirect(`${settingsUrl}?accounting=connected&provider=${provider.key}`);
  } catch (err: any) {
    req.log.error(err, "Accounting callback failed");
    fail(err?.message || "Could not finish connecting.");
  }
});

/** Unlink. Keeps the row so the history of what was pushed still makes sense. */
router.delete("/accounting/:provider", requireTenantAccess, async (req: any, res) => {
  try {
    await db.update(accountingConnectionsTable).set({
      status: "disconnected",
      // Tokens are cleared on disconnect. Keeping a live credential for an
      // integration the tenant has switched off is not ours to hold.
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    }).where(and(
      eq(accountingConnectionsTable.tenantId, tid(req)),
      eq(accountingConnectionsTable.provider, String(req.params.provider)),
    ));
    res.status(204).end();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/** Push one invoice by hand. */
router.post("/accounting/invoices/:id/sync", requireTenantAccess, async (req: any, res) => {
  try {
    const result = await syncInvoice(Number(req.params.id), tid(req));
    if (!result.ok) { res.status(422).json(result); return; }
    res.json(result);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * Catch up everything that has not gone yet.
 *
 * Capped and sequential on purpose: these are somebody's accounts, and firing
 * fifty concurrent writes at a rate-limited API is how half of them land and
 * the other half need working out by hand afterwards.
 */
router.post("/accounting/sync-pending", requireTenantAccess, async (req: any, res) => {
  try {
    const tenantId = tid(req);
    const pending = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, tenantId),
      isNull(invoicesTable.accountingExternalId),
      sql`${invoicesTable.status} NOT IN ('draft', 'void')`,
    )).orderBy(desc(invoicesTable.issuedOn)).limit(25);

    let sent = 0;
    const problems: string[] = [];
    for (const row of pending) {
      const result = await syncInvoice(row.id, tenantId);
      if (result.ok) sent++;
      else {
        problems.push(result.reason);
        // A dead connection will fail identically for all twenty-five. Stop
        // rather than writing the same error onto every invoice.
        if (result.needsReauth) break;
      }
    }
    res.json({ sent, attempted: pending.length, problems: [...new Set(problems)].slice(0, 3) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
