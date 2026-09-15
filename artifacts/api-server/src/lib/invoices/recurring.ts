import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import {
  db, invoicesTable, invoiceItemsTable, tenantSettingsTable,
  type InvoiceRecurrence,
} from "@workspace/db";
import { computeTotals } from "./totals";
import { nextInvoiceReference } from "./reference";
import { logger } from "../logger";

/**
 * The engine behind repeating invoices.
 *
 * A landlord gas safety round, a monthly maintenance contract, a quarterly
 * service: the same invoice, same customer, same day, forever. Retyping it
 * every month means that sooner or later it does not get typed at all, and the
 * month is simply not billed.
 *
 * The head of a series is a real invoice — the customer really did get the
 * January one — and it carries the schedule. Each cycle we clone it. The clone
 * never carries a recurrence of its own; if it did, every copy would start a
 * series and one maintenance contract would become an invoice fork bomb.
 */

/** Months to step for the cadences that move in months. */
const MONTH_STEP: Partial<Record<InvoiceRecurrence, number>> = {
  monthly: 1, quarterly: 3, six_monthly: 6, yearly: 12,
};
const DAY_STEP: Partial<Record<InvoiceRecurrence, number>> = {
  weekly: 7, fortnightly: 14,
};

/**
 * The next date in the series, as YYYY-MM-DD.
 *
 * Month arithmetic is done on the CALENDAR, not on 30-day blocks, and it is
 * clamped: a series anchored on the 31st bills on the 28th in February and
 * goes back to the 31st in March. Stepping a JS Date by a month from the 31st
 * of January silently lands you on the 2nd or 3rd of March, which would drag
 * the whole series forward a few days every year until a "monthly" invoice
 * arrives in the middle of the month.
 *
 * @param anchorDay the day-of-month the series is anchored to, which is the
 *   day of the FIRST invoice — not the day of the last one, which may itself
 *   have been clamped down by a short month.
 */
export function nextOccurrence(
  from: string,
  cadence: InvoiceRecurrence,
  anchorDay?: number,
): string {
  const [y, m, d] = from.split("-").map(Number);

  const days = DAY_STEP[cadence];
  if (days) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  const months = MONTH_STEP[cadence] ?? 1;
  const targetMonthIndex = (m - 1) + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // Day 0 of the following month is the last day of this one.
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(anchorDay ?? d, lastDayOfTarget);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates. Used to keep the payment window. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function addDays(date: string, n: number): string {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export type SweepResult = {
  seriesChecked: number;
  invoicesCreated: number;
  invoicesSent: number;
  seriesEnded: number;
  errors: number;
};

/**
 * Issue every copy that has fallen due, across every tenant.
 *
 * Catches up rather than skipping: if the container was down for a week, or a
 * series was set up with a start date in the past, each missed cycle produces
 * its own invoice. A month that was not billed is money the trade never sees,
 * so quietly jumping to the next due date would lose it silently. The per-run
 * cap stops a badly-typed start date from generating a thousand rows.
 */
export async function sweepRecurringInvoices(opts: { maxPerSeries?: number } = {}): Promise<SweepResult> {
  const maxPerSeries = opts.maxPerSeries ?? 24;
  const now = today();
  const result: SweepResult = {
    seriesChecked: 0, invoicesCreated: 0, invoicesSent: 0, seriesEnded: 0, errors: 0,
  };

  const heads = await db.select().from(invoicesTable).where(and(
    isNotNull(invoicesTable.recurrence),
    isNotNull(invoicesTable.recurrenceNextOn),
    lte(invoicesTable.recurrenceNextOn, now),
    // A voided head stops its series. Voiding the January invoice and still
    // receiving February's would be the platform arguing with its user.
    sql`${invoicesTable.status} <> 'void'`,
  ));

  for (const head of heads) {
    result.seriesChecked++;
    try {
      const cadence = head.recurrence as InvoiceRecurrence;
      // The anchor is the day of the FIRST invoice, so a series clamped down by
      // February goes back to the 31st in March instead of staying on the 28th.
      const anchorDay = head.issuedOn ? Number(head.issuedOn.slice(8, 10)) : undefined;
      // The payment window the head was given, kept on every copy.
      const windowDays = head.issuedOn && head.dueOn ? daysBetween(head.issuedOn, head.dueOn) : 14;

      const items = await db.select().from(invoiceItemsTable)
        .where(eq(invoiceItemsTable.invoiceId, head.id))
        .orderBy(invoiceItemsTable.sortOrder);

      const [settings] = await db.select().from(tenantSettingsTable)
        .where(eq(tenantSettingsTable.tenantId, head.tenantId)).limit(1);
      const vatRate = settings?.vatRegistered ? (settings.vatRate ?? "20") : null;
      const cisRate = settings?.cisRegistered ? (settings.cisRate ?? "20") : null;

      let dueOnDate = head.recurrenceNextOn as string;
      let made = 0;

      while (dueOnDate <= now && made < maxPerSeries) {
        if (head.recurrenceUntil && dueOnDate > head.recurrenceUntil) break;

        // Totals are recomputed from the lines rather than copied off the head.
        // The tenant's VAT or CIS position may have changed since the series
        // started, and a copy must be right today, not right in January.
        const totals = computeTotals(
          items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            vatRate: vatRate === null ? null : i.vatRate,
          })),
          vatRate,
          cisRate,
        );

        const [copy] = await db.insert(invoicesTable).values({
          tenantId: head.tenantId,
          customerId: head.customerId,
          projectId: head.projectId,
          reference: await nextInvoiceReference(head.tenantId),
          status: "draft",
          issuedOn: dueOnDate,
          dueOn: addDays(dueOnDate, windowDays),
          vatRate,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          cisDeduction: totals.cisDeduction,
          total: totals.total,
          notes: head.notes,
          terms: head.terms,
          // The copy is a leaf, never a head. See the fork-bomb note above.
          recurrenceSourceId: head.recurrenceSourceId ?? head.id,
        }).returning();

        if (totals.lines.length) {
          await db.insert(invoiceItemsTable).values(totals.lines.map((l, i) => ({
            invoiceId: copy.id,
            description: l.description,
            quantity: String(l.quantity ?? 1),
            unitPrice: String(l.unitPrice),
            vatRate: l.vatRate,
            total: l.total,
            sortOrder: i,
          })));
        }

        made++;
        result.invoicesCreated++;

        /**
         * Sending, when the tenant asked for it.
         *
         * The same three checks the Send button makes, because a recurring
         * invoice with no lines or no customer would otherwise be emailed to
         * nobody and marked sent. Failing them leaves the copy as a draft,
         * which is visible and fixable, rather than losing it.
         */
        if (head.recurrenceAutoSend && copy.customerId && totals.lines.length && Number(copy.total) > 0) {
          await db.update(invoicesTable)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(invoicesTable.id, copy.id));
          // Awaited, not fire-and-forget: this runs in a batch job with no
          // request to keep the process alive, and an unawaited promise here
          // would be cut off when the sweep returns.
          try {
            const { sendInvoiceEmail } = await import("./deliver");
            await sendInvoiceEmail(copy.id, head.tenantId);
          } catch (err) {
            logger.error({ err, invoiceId: copy.id }, "Recurring invoice email failed");
          }
          result.invoicesSent++;
        }

        dueOnDate = nextOccurrence(dueOnDate, cadence, anchorDay);
      }

      const finished = Boolean(head.recurrenceUntil && dueOnDate > head.recurrenceUntil);
      if (finished) result.seriesEnded++;

      await db.update(invoicesTable).set({
        recurrenceNextOn: finished ? null : dueOnDate,
        // Ending a series clears the cadence too, so the head stops matching the
        // sweep's filter instead of being re-read and re-skipped every night.
        recurrence: finished ? null : head.recurrence,
        recurrenceCount: head.recurrenceCount + made,
      }).where(eq(invoicesTable.id, head.id));

      if (made > 0) {
        logger.info({ headInvoiceId: head.id, tenantId: head.tenantId, made },
          "Recurring invoices issued");
      }
    } catch (err) {
      result.errors++;
      // One broken series must not stop the other tenants' billing, but it also
      // must not vanish — the Google review sync spent months silently doing
      // nothing for exactly this reason.
      logger.error({ err, headInvoiceId: head.id, tenantId: head.tenantId },
        "Recurring invoice series failed");
    }
  }

  return result;
}

/**
 * Turn a series on, off, or change its cadence.
 *
 * Called by the route rather than doing its own auth: every caller has already
 * proved the invoice belongs to the tenant.
 */
export function firstOccurrenceAfter(issuedOn: string, cadence: InvoiceRecurrence): string {
  return nextOccurrence(issuedOn, cadence, Number(issuedOn.slice(8, 10)));
}
