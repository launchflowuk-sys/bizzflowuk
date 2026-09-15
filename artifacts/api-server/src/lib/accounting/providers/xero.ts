import { AccountingError, type AccountingProvider, type AccountingCredentials, type OutboundInvoice } from "../types";

/**
 * Xero.
 *
 * VERIFY BEFORE TRUSTING THIS IN ANGER. It is written against Xero's published
 * OAuth 2.0 and Accounting API v2.0 behaviour, but it has never run against a
 * real Xero account because we do not have an app registration yet. The shapes
 * below are the ones to check first, in this order:
 *
 *   1. DONE, 15 Sep 2026. The first attempt was rejected with
 *      `invalid_scope` because it asked for openid/profile/email, which this
 *      integration never reads. See the SCOPES note below.
 *   2. `POST /api.xro/2.0/Invoices` accepting an array under "Invoices" and
 *      returning the created one under the same key.
 *   3. Whether the sales account code below suits the tenant's chart of
 *      accounts. 200 is Xero's demo-company sales code and is NOT universal.
 *
 * Nothing here silently swallows a failure: every non-2xx becomes an
 * AccountingError carrying Xero's own words, which end up on the invoice.
 */

const AUTH_BASE = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com";

/**
 * Least privilege, and no more.
 *
 * THE IDENTITY SCOPES ARE DELIBERATELY ABSENT. The first version asked for
 * `openid profile email` and Xero answered the authorise request with
 * `invalid_scope`. Adding them was my own inconsistency: the comment said
 * least privilege and the list then asked for the signed-in person's identity,
 * which this integration never reads. We push invoices and match contacts;
 * we do not care who is holding the browser.
 *
 * Dropping them is the right call regardless of the error -- an app asking for
 * more than it uses is the thing that gets rejected at certification, and it
 * is also what a tenant sees listed on the consent screen before they decide
 * whether to trust us.
 *
 * `offline_access` is the one that is easy to miss and impossible to work
 * around later: without it Xero issues no refresh token, the connection dies
 * after thirty minutes, and the tenant is asked to reconnect forever.
 */
const SCOPES = [
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
];

function basicAuth(): string {
  const id = process.env["XERO_CLIENT_ID"] ?? "";
  const secret = process.env["XERO_CLIENT_SECRET"] ?? "";
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Xero returns expires_in seconds; we store an absolute moment. */
function expiryFrom(seconds: unknown): Date | null {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return null;
  // Thirty seconds of headroom so a token does not expire mid-request.
  return new Date(Date.now() + (n - 30) * 1000);
}

async function tokenRequest(body: URLSearchParams): Promise<any> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    // 400 invalid_grant on a refresh means the token is dead, not that Xero is
    // broken — that is a reconnect, not a retry.
    const dead = res.status === 400 && text.includes("invalid_grant");
    throw new AccountingError(
      dead ? "Xero needs you to reconnect." : `Xero rejected the request: ${text.slice(0, 300)}`,
      { needsReauth: dead, retryable: res.status >= 500 },
    );
  }
  return JSON.parse(text);
}

/**
 * Which Xero organisation this token is for.
 *
 * Xero is unusual here: the token alone is not enough to call the Accounting
 * API. Every request needs an `xero-tenant-id` header naming the organisation,
 * and that comes from a separate /connections call after the exchange.
 */
async function firstConnection(accessToken: string): Promise<{ id: string | null; name: string | null }> {
  const res = await fetch(`${API_BASE}/connections`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (!res.ok) return { id: null, name: null };
  const list = await res.json().catch(() => []) as any[];
  const first = Array.isArray(list) ? list[0] : null;
  return { id: first?.tenantId ?? null, name: first?.tenantName ?? null };
}

async function credentialsFrom(payload: any): Promise<AccountingCredentials> {
  const accessToken = payload?.access_token;
  if (!accessToken) throw new AccountingError("Xero did not return an access token.");
  const org = await firstConnection(accessToken);
  return {
    accessToken,
    refreshToken: payload?.refresh_token ?? null,
    expiresAt: expiryFrom(payload?.expires_in),
    organisationId: org.id,
    organisationName: org.name,
  };
}

export const xero: AccountingProvider = {
  key: "xero",
  label: "Xero",
  description: "Send every invoice you raise straight into Xero, with the customer attached.",
  requiredEnv: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"],

  authorizeUrl({ state, redirectUri }) {
    /**
     * Built by hand rather than with URLSearchParams, for one reason: it
     * encodes a space as `+`, and the scope list is the one parameter where
     * that is worth not gambling on. Xero's own documented examples use `%20`,
     * which is what encodeURIComponent produces. Both are legal; only one is
     * the one they show.
     */
    const query = [
      "response_type=code",
      `client_id=${encodeURIComponent(process.env["XERO_CLIENT_ID"] ?? "")}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `scope=${encodeURIComponent(SCOPES.join(" "))}`,
      `state=${encodeURIComponent(state)}`,
    ].join("&");
    return `${AUTH_BASE}?${query}`;
  },

  async exchangeCode({ code, redirectUri }) {
    return credentialsFrom(await tokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    })));
  },

  async refresh(refreshToken) {
    try {
      return await credentialsFrom(await tokenRequest(new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      })));
    } catch (err) {
      // A dead refresh token is an answer, not a failure: null tells the caller
      // to mark the connection needs_reauth rather than retry forever.
      if (err instanceof AccountingError && err.needsReauth) return null;
      throw err;
    }
  },

  async pushInvoice({ credentials, invoice }) {
    if (!credentials.organisationId) {
      throw new AccountingError("No Xero organisation is linked to this connection.", { needsReauth: true });
    }

    /**
     * Xero matches a contact by name when no ContactID is given, and CREATES
     * one if it does not recognise it. That is why the customer's external id
     * is passed back whenever we have it: without it, a customer whose name is
     * punctuated slightly differently ends up as a second contact, and the
     * trade's Xero fills up with near-duplicates.
     */
    const contact = invoice.customer
      ? (invoice.customer.externalId
        ? { ContactID: invoice.customer.externalId }
        : {
          Name: invoice.customer.name,
          ...(invoice.customer.email ? { EmailAddress: invoice.customer.email } : {}),
          ...(invoice.customer.address || invoice.customer.city || invoice.customer.postcode
            ? {
              Addresses: [{
                AddressType: "STREET",
                AddressLine1: invoice.customer.address ?? "",
                City: invoice.customer.city ?? "",
                PostalCode: invoice.customer.postcode ?? "",
              }],
            }
            : {}),
        })
      : { Name: "Customer not recorded" };

    const body = {
      Invoices: [{
        Type: "ACCREC",                 // money coming in
        Contact: contact,
        ...(invoice.issuedOn ? { Date: invoice.issuedOn } : {}),
        ...(invoice.dueOn ? { DueDate: invoice.dueOn } : {}),
        InvoiceNumber: invoice.reference,
        Reference: invoice.reference,
        // Sent to Xero as a DRAFT on purpose. It is the tenant's book of
        // record and an automated push should never authorise an entry in it
        // — they approve it in Xero, where they can see it against everything
        // else.
        Status: "DRAFT",
        LineAmountTypes: "Exclusive",   // our totals are ex-VAT
        ...(invoice.notes ? { Reference: invoice.reference } : {}),
        LineItems: invoice.lines.map(l => ({
          Description: l.description,
          Quantity: Number(l.quantity),
          UnitAmount: Number(l.unitPrice),
          // NOTE TO VERIFY: 200 is the sales code in Xero's demo company and
          // is not universal. This wants to be a per-tenant setting on the
          // connection before anyone relies on it.
          AccountCode: String((invoice as any).salesAccountCode ?? "200"),
          ...(l.vatRate === null
            ? { TaxType: "NONE" }
            : { TaxType: Number(l.vatRate) === 0 ? "ZERORATED" : "OUTPUT2" }),
        })),
      }],
    };

    const res = await fetch(`${API_BASE}/api.xro/2.0/Invoices`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        "xero-tenant-id": credentials.organisationId,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new AccountingError(
        `Xero would not accept the invoice: ${text.slice(0, 400)}`,
        { needsReauth: res.status === 401, retryable: res.status === 429 || res.status >= 500 },
      );
    }

    const created = JSON.parse(text)?.Invoices?.[0];
    if (!created?.InvoiceID) {
      throw new AccountingError("Xero accepted the invoice but did not say what it created.");
    }

    return {
      externalId: created.InvoiceID,
      customerExternalId: created?.Contact?.ContactID ?? null,
      url: null,
    };
  },
};
