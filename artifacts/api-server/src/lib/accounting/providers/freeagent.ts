import { AccountingError, type AccountingProvider, type AccountingCredentials } from "../types";

/**
 * FreeAgent.
 *
 * VERIFY BEFORE TRUSTING THIS IN ANGER, same as Xero: written against
 * FreeAgent's published OAuth 2.0 and v2 API behaviour, never run against a
 * real account because there is no app registration yet. Check these first:
 *
 *   1. That contacts are created at /v2/contacts and the response carries the
 *      contact's URL under `contact.url`. FreeAgent identifies everything by
 *      URL rather than by id, which is the single biggest difference from
 *      every other provider and the thing most likely to be wrong here.
 *   2. That invoice line items accept `category` as a URL.
 *   3. Whether the sandbox host is wanted. FREEAGENT_SANDBOX=1 switches it.
 *
 * FreeAgent is worth supporting properly: it is very common among UK sole
 * traders and small trades, more so than Xero at Brandon's size.
 */

const LIVE = { auth: "https://api.freeagent.com", api: "https://api.freeagent.com" };
const SANDBOX = { auth: "https://api.sandbox.freeagent.com", api: "https://api.sandbox.freeagent.com" };

function hosts() {
  return process.env["FREEAGENT_SANDBOX"] ? SANDBOX : LIVE;
}

function expiryFrom(seconds: unknown): Date | null {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return null;
  return new Date(Date.now() + (n - 30) * 1000);
}

async function tokenRequest(body: URLSearchParams): Promise<any> {
  const res = await fetch(`${hosts().auth}/v2/token_endpoint`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(
        `${process.env["FREEAGENT_CLIENT_ID"] ?? ""}:${process.env["FREEAGENT_CLIENT_SECRET"] ?? ""}`,
      ).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    const dead = res.status === 400 || res.status === 401;
    throw new AccountingError(
      dead ? "FreeAgent needs you to reconnect." : `FreeAgent rejected the request: ${text.slice(0, 300)}`,
      { needsReauth: dead, retryable: res.status >= 500 },
    );
  }
  return JSON.parse(text);
}

/** The business this token belongs to, for showing on the settings card. */
async function company(accessToken: string): Promise<{ name: string | null }> {
  try {
    const res = await fetch(`${hosts().api}/v2/company`, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (!res.ok) return { name: null };
    const body = await res.json() as any;
    return { name: body?.company?.name ?? null };
  } catch { return { name: null }; }
}

async function credentialsFrom(payload: any): Promise<AccountingCredentials> {
  const accessToken = payload?.access_token;
  if (!accessToken) throw new AccountingError("FreeAgent did not return an access token.");
  const c = await company(accessToken);
  return {
    accessToken,
    refreshToken: payload?.refresh_token ?? null,
    expiresAt: expiryFrom(payload?.expires_in),
    // FreeAgent has no per-organisation id — one set of tokens is one company.
    organisationId: null,
    organisationName: c.name,
  };
}

export const freeagent: AccountingProvider = {
  key: "freeagent",
  label: "FreeAgent",
  description: "Push invoices and contacts into FreeAgent as you raise them.",
  requiredEnv: ["FREEAGENT_CLIENT_ID", "FREEAGENT_CLIENT_SECRET"],

  authorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env["FREEAGENT_CLIENT_ID"] ?? "",
      redirect_uri: redirectUri,
      state,
    });
    return `${hosts().auth}/v2/approve_app?${params.toString()}`;
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
      if (err instanceof AccountingError && err.needsReauth) return null;
      throw err;
    }
  },

  async pushInvoice({ credentials, invoice }) {
    const api = hosts().api;
    const headers = {
      authorization: `Bearer ${credentials.accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
    };

    /**
     * FreeAgent identifies everything by URL, not by id.
     *
     * An invoice references its contact as a full URL like
     * https://api.freeagent.com/v2/contacts/12345, so the contact has to exist
     * first and we have to keep its URL. That is what customers.
     * accounting_external_id holds for this provider — a URL, not a number.
     */
    let contactUrl = invoice.customer?.externalId ?? null;

    if (!contactUrl && invoice.customer) {
      const [first, ...rest] = invoice.customer.name.trim().split(/\s+/);
      const res = await fetch(`${api}/v2/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contact: {
            first_name: first || invoice.customer.name,
            last_name: rest.join(" ") || "",
            ...(invoice.customer.email ? { email: invoice.customer.email } : {}),
            ...(invoice.customer.phone ? { phone_number: invoice.customer.phone } : {}),
            ...(invoice.customer.address ? { address1: invoice.customer.address } : {}),
            ...(invoice.customer.city ? { town: invoice.customer.city } : {}),
            ...(invoice.customer.postcode ? { postcode: invoice.customer.postcode } : {}),
          },
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new AccountingError(
          `FreeAgent would not create the customer: ${text.slice(0, 300)}`,
          { needsReauth: res.status === 401, retryable: res.status === 429 || res.status >= 500 },
        );
      }
      contactUrl = JSON.parse(text)?.contact?.url ?? null;
    }

    if (!contactUrl) {
      // FreeAgent will not take an invoice without one, so say so plainly
      // rather than sending something it is certain to reject.
      throw new AccountingError("FreeAgent needs a customer on the invoice before it can be sent.");
    }

    const res = await fetch(`${api}/v2/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        invoice: {
          contact: contactUrl,
          dated_on: invoice.issuedOn,
          ...(invoice.dueOn && invoice.issuedOn
            ? {
              payment_terms_in_days: Math.max(
                0,
                Math.round((Date.parse(invoice.dueOn) - Date.parse(invoice.issuedOn)) / 86_400_000),
              ),
            }
            : {}),
          reference: invoice.reference,
          currency: "GBP",
          // Raised as a draft. The tenant's accounts are their book of record
          // and an automated push should never mark something as issued there.
          status: "Draft",
          invoice_items: invoice.lines.map(l => ({
            description: l.description,
            item_type: "Services",
            quantity: Number(l.quantity),
            price: Number(l.unitPrice),
            // null means the business is not VAT registered, so no rate at all
            // rather than a zero that reads as zero-rated.
            ...(l.vatRate === null ? {} : { sales_tax_rate: Number(l.vatRate) }),
          })),
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new AccountingError(
        `FreeAgent would not accept the invoice: ${text.slice(0, 400)}`,
        { needsReauth: res.status === 401, retryable: res.status === 429 || res.status >= 500 },
      );
    }

    const created = JSON.parse(text)?.invoice;
    if (!created?.url) {
      throw new AccountingError("FreeAgent accepted the invoice but did not say what it created.");
    }

    return {
      externalId: created.url,
      customerExternalId: contactUrl,
      url: created.url,
    };
  },
};
