/**
 * What an accounting package has to be able to do for us.
 *
 * Same shape as the certificate and automation registries: a provider is a
 * definition plus a handful of functions, and adding one is an entry in a
 * file. That matters more here than usual, because "which accounting package"
 * is the single most varied thing about a small trade business — Xero,
 * FreeAgent, QuickBooks, Sage, and a long tail after that.
 *
 * DELIBERATELY ONE DIRECTION: we push invoices out, we do not pull anything
 * back. Two-way sync between two systems that both think they own the invoice
 * is a class of problem — conflicting edits, delete semantics, which one wins
 * — that a plumber should never have to think about. Their accounts are the
 * book of record once the invoice lands there; we are where it is raised.
 */

export type AccountingCredentials = {
  accessToken: string;
  refreshToken: string | null;
  /** Absolute expiry, not a duration — a duration is only true at the moment it is issued. */
  expiresAt: Date | null;
  organisationId: string | null;
  organisationName: string | null;
};

/** What the tenant is sending. Flattened so a provider never touches our schema. */
export type OutboundInvoice = {
  reference: string;
  issuedOn: string | null;
  dueOn: string | null;
  /** Ex-VAT. */
  subtotal: string;
  vatAmount: string;
  total: string;
  notes: string | null;
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    /** Null when the business is not VAT registered. */
    vatRate: string | null;
    total: string;
  }>;
  customer: {
    /** Their id at the provider, when we have pushed them before. */
    externalId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postcode: string | null;
  } | null;

  /**
   * Which account in THEIR chart of accounts the sale lands in.
   *
   * This was hardcoded to "200", which is the sales code in Xero's demo
   * company and in their default UK chart — so it worked in testing and will
   * keep working for most people. It is not universal: a business that built
   * its own chart, or migrated one in from another package, can easily have
   * 200 as something else entirely or not have it at all. Posting revenue to
   * the wrong nominal is the kind of error their accountant finds in January.
   *
   * Null means "use the provider's default", which is the right behaviour for
   * the many tenants who will never think about this.
   */
  salesAccountCode: string | null;
};

export type PushResult = {
  /** The provider's id for the created invoice. Stored as the idempotency latch. */
  externalId: string;
  /** Their id for the contact, if the provider created or matched one. */
  customerExternalId?: string | null;
  /** A link a human can open in the accounting package, when the provider gives one. */
  url?: string | null;
};

/**
 * Thrown by a provider when something goes wrong, with the one fact the caller
 * actually needs to decide what to do about it.
 */
export class AccountingError extends Error {
  /** True when the connection needs the tenant to consent again. */
  readonly needsReauth: boolean;
  /** True when retrying later might work — a timeout, a 429, a 5xx. */
  readonly retryable: boolean;
  constructor(message: string, opts: { needsReauth?: boolean; retryable?: boolean } = {}) {
    super(message);
    this.name = "AccountingError";
    this.needsReauth = opts.needsReauth ?? false;
    this.retryable = opts.retryable ?? false;
  }
}

export type AccountingProvider = {
  key: string;
  label: string;
  /** One line, in the operator's language, for the card in Settings. */
  description: string;
  /** The env vars this provider needs before it can be offered at all. */
  requiredEnv: string[];

  /** Where to send the tenant to give consent. */
  authorizeUrl(args: { state: string; redirectUri: string }): string;

  /** Swap the code from the callback for tokens. */
  exchangeCode(args: { code: string; redirectUri: string }): Promise<AccountingCredentials>;

  /**
   * Get a fresh access token. Returning null means the refresh token is dead
   * and the tenant has to reconnect — distinct from throwing, which means
   * something broke.
   */
  refresh(refreshToken: string): Promise<AccountingCredentials | null>;

  /** Create the invoice in their accounts. */
  pushInvoice(args: { credentials: AccountingCredentials; invoice: OutboundInvoice }): Promise<PushResult>;
};

/** Is this provider actually usable, or is its app registration still missing? */
export function providerConfigured(provider: AccountingProvider): boolean {
  return provider.requiredEnv.every(name => Boolean(process.env[name]));
}
