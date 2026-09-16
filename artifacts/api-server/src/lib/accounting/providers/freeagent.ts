import { AccountingError, type AccountingProvider, type AccountingCredentials } from "../types";

/**
 * FreeAgent.
 *
 * Worth supporting properly: among UK sole traders and small trades it is more
 * common than Xero, which is exactly the size of business this platform sells
 * to.
 *
 * CHECKED AGAINST THE PUBLISHED API, not assumed. Everything below was read
 * off dev.freeagent.com rather than inferred from how other providers behave,
 * because the last integration cost four failed attempts to settle one detail
 * that a minute of reading would have answered. What that check changed:
 *
 *   - `payment_terms_in_days` is REQUIRED, along with dated_on and due_on. The
 *     first draft sent payment terms only when both dates happened to be
 *     present, so any invoice raised without a due date would have been
 *     rejected outright - surfacing as a vague "FreeAgent would not accept the
 *     invoice" with nothing pointing at the cause.
 *   - `status` is NOT a creation attribute. FreeAgent always creates an
 *     invoice as a draft, which is the behaviour we wanted anyway.
 *   - `category` on a line item is optional and is a URL, like everything else
 *     in this API. It carries the tenant's sales code when they have set one.
 *   - Contact attributes confirmed: `town` exists (it is not `city`),
 *     addresses are address1/2/3, phone is `phone_number`, and the response
 *     carries the new contact's URL at `contact.url`.
 *
 * STILL UNVERIFIED, and honestly so: none of this has run against a real
 * FreeAgent account, because that needs an app registration. The shape is
 * right; the first live connection is still the real test.
 *
 * FREEAGENT_SANDBOX=1 switches every host to the sandbox.
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

    /**
     * dated_on, due_on and payment_terms_in_days are ALL required.
     *
     * Checked against FreeAgent's invoice documentation rather than assumed.
     * An earlier version sent payment terms only when both dates happened to
     * be present, which would have been rejected outright for any invoice
     * raised without a due date - and the failure would have read as a vague
     * "FreeAgent would not accept the invoice" with nothing pointing at why.
     */
    if (!invoice.issuedOn) {
      throw new AccountingError("FreeAgent needs the invoice to have a date on it before it can go across.");
    }
    const termDays = invoice.dueOn
      ? Math.max(0, Math.round((Date.parse(invoice.dueOn) - Date.parse(invoice.issuedOn)) / 86_400_000))
      : 0; // FreeAgent's own meaning for zero: due on receipt.
    const dueOn = invoice.dueOn ?? invoice.issuedOn;

    /**
     * Where the revenue is booked.
     *
     * FreeAgent's equivalent of Xero's account code, and like everything else
     * in its API it is addressed by URL rather than by id. The tenant types the
     * code they see in FreeAgent ("001") and we build the URL. Left off
     * entirely when they have not set one - the field is optional and
     * FreeAgent picks its own default, which beats us guessing at a category
     * that may not exist in their account.
     */
    const categoryUrl = invoice.salesAccountCode
      ? `${api}/v2/categories/${encodeURIComponent(invoice.salesAccountCode)}`
      : null;

    const res = await fetch(`${api}/v2/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        invoice: {
          contact: contactUrl,
          dated_on: invoice.issuedOn,
          due_on: dueOn,
          payment_terms_in_days: termDays,
          reference: invoice.reference,
          currency: "GBP",
          // No `status`. FreeAgent always creates an invoice as a draft and
          // does not take status at creation - which is the behaviour we
          // wanted anyway: their accounts are their book of record, and an
          // automated push should never mark something as issued in them.
          invoice_items: invoice.lines.map(l => ({
            description: l.description,
            item_type: "Services",
            quantity: Number(l.quantity),
            price: Number(l.unitPrice),
            ...(categoryUrl ? { category: categoryUrl } : {}),
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
