/**
 * Invoice arithmetic.
 *
 * Money is stored as numeric(10,2) strings, the same as quotes, so every sum here
 * works in integer pence and only converts back at the edge. Doing it in floats
 * gives you 0.1 + 0.2 on an invoice, which is the kind of bug a customer notices
 * and never forgets.
 */

export type LineInput = {
  description: string;
  quantity?: string | number | null;
  unitPrice: string | number;
  /** Per-line, so labour at 20% and materials at 0% can sit on one invoice. */
  vatRate?: string | number | null;
};

export type ComputedLine = LineInput & { total: string; vatRate: string | null };

/** numeric string or number -> integer pence. */
function pence(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function money(p: number): string {
  return (p / 100).toFixed(2);
}

function rate(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type Totals = {
  lines: ComputedLine[];
  subtotal: string;
  vatAmount: string;
  cisDeduction: string;
  total: string;
};

/**
 * @param defaultVatRate the tenant's rate, or null when they are not VAT
 *   registered. A null rate produces no VAT at all — an invoice must never show
 *   VAT for a business that has not told us it charges it.
 * @param cisRate percentage deducted from labour under the Construction Industry
 *   Scheme, or null. Applied to the subtotal, after VAT is calculated, because
 *   CIS is deducted from the payment rather than from the taxable amount.
 */
export function computeTotals(
  items: LineInput[],
  defaultVatRate: string | number | null | undefined,
  cisRate?: string | number | null,
): Totals {
  const fallback = rate(defaultVatRate);

  let subtotalP = 0;
  let vatP = 0;
  const lines: ComputedLine[] = [];

  for (const item of items) {
    const qty = item.quantity === undefined || item.quantity === null || item.quantity === ""
      ? 1
      : Number(item.quantity);
    const unitP = pence(item.unitPrice);
    const lineP = Math.round(unitP * (Number.isFinite(qty) ? qty : 1));

    // An explicit per-line rate wins, including an explicit 0 for zero-rated
    // materials. Only an absent rate falls back to the tenant default.
    const lineRate = item.vatRate === undefined || item.vatRate === null || item.vatRate === ""
      ? fallback
      : rate(item.vatRate);

    subtotalP += lineP;
    if (lineRate !== null) vatP += Math.round(lineP * (lineRate / 100));

    lines.push({ ...item, total: money(lineP), vatRate: lineRate === null ? null : lineRate.toFixed(2) });
  }

  const cis = rate(cisRate);
  const cisP = cis ? Math.round(subtotalP * (cis / 100)) : 0;

  return {
    lines,
    subtotal: money(subtotalP),
    vatAmount: money(vatP),
    cisDeduction: money(cisP),
    total: money(subtotalP + vatP - cisP),
  };
}

/** Outstanding balance in pounds, as a numeric string. Never negative. */
export function outstanding(total: string | number, amountPaid: string | number): string {
  return money(Math.max(0, pence(total) - pence(amountPaid)));
}

/**
 * Status derived from what has actually been paid, so a listing can never show
 * "sent" on an invoice that is fully settled.
 *
 * Draft and void are terminal decisions by the user and are never overridden.
 */
export function deriveStatus(args: {
  current: string;
  total: string | number;
  amountPaid: string | number;
  dueOn?: string | null;
  today?: string;
}): string {
  if (args.current === "draft" || args.current === "void") return args.current;

  const totalP = pence(args.total);
  const paidP = pence(args.amountPaid);

  if (totalP > 0 && paidP >= totalP) return "paid";
  if (paidP > 0) return "part_paid";

  if (args.dueOn) {
    const today = args.today ?? new Date().toISOString().slice(0, 10);
    if (args.dueOn < today) return "overdue";
  }
  return "sent";
}

export { money, pence };
