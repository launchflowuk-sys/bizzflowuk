export interface SquareCreds {
  applicationId: string;
  locationId: string;
  accessToken: string;
  environment: "sandbox" | "production";
}

export interface CreateSquarePaymentOptions {
  sourceId: string;
  amount: number; // major units, e.g. 250.00
  currency: string;
  idempotencyKey: string;
  creds: SquareCreds;
}

export interface SquarePaymentResult {
  paymentId: string;
  status: string; // Square's raw payment status, e.g. "COMPLETED", "FAILED"
}

export class SquarePaymentError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function baseUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

// Square requires all card amounts in the smallest currency unit (pence for GBP).
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export async function createSquarePayment(opts: CreateSquarePaymentOptions): Promise<SquarePaymentResult> {
  const { creds } = opts;
  const res = await fetch(`${baseUrl(creds.environment)}/v2/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.accessToken}`,
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      source_id: opts.sourceId,
      idempotency_key: opts.idempotencyKey,
      location_id: creds.locationId,
      amount_money: {
        amount: toMinorUnits(opts.amount),
        currency: opts.currency,
      },
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as any)?.errors ?? data;
    throw new SquarePaymentError(`Square payment failed (${res.status})`, res.status, detail);
  }

  const payment = (data as any)?.payment;
  return { paymentId: payment?.id, status: payment?.status };
}
