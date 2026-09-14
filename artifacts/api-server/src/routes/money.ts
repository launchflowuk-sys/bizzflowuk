import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, expensesTable, projectsTable, quotesTable, tenantSettingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";

const router = Router();
function tid(req: any): number { return req.authUser?.tenantId!; }

/**
 * Cash flow and the VAT position.
 *
 * Known money only — no bank feed, no HMRC connection, no accounting sync. Every
 * figure here comes from invoices, expenses and booked jobs the business has
 * already entered, and the screen says so. That is a deliberate choice: the
 * forecast is useful immediately, and an honest limitation beats an integration
 * nobody has connected yet.
 */

function money(p: number): string { return (p / 100).toFixed(2); }
function pence(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

router.get("/money/cash-flow", requireTenantAccess, async (req: any, res) => {
  try {
    const tenantId = tid(req);
    const weeks = Math.max(4, Math.min(26, Number(req.query.weeks) || 13));

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + weeks * 7);
    const horizonKey = horizon.toISOString().slice(0, 10);

    // Money in: what is invoiced and not yet paid.
    const open = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, tenantId),
      sql`${invoicesTable.status} IN ('sent','part_paid','overdue')`,
    ));

    // Money out: recent spending, used as the run-rate for the weeks ahead.
    const recentSpend = await db.select().from(expensesTable).where(and(
      eq(expensesTable.tenantId, tenantId),
      sql`${expensesTable.spentOn} >= (CURRENT_DATE - INTERVAL '90 days')`,
    ));

    // Booked work that has not been invoiced yet — real money, but only counted
    // where a value is known, never guessed from a job title.
    const booked = await db.select().from(projectsTable).where(and(
      eq(projectsTable.tenantId, tenantId),
      sql`${projectsTable.scheduledStart} IS NOT NULL`,
      sql`${projectsTable.scheduledStart} <= ${horizonKey}`,
      sql`${projectsTable.scheduledStart} >= CURRENT_DATE`,
      sql`${projectsTable.status} <> 'Completed'`,
    ));

    // Quotes with no job yet are deliberately excluded from the headline and
    // reported separately. Counting work nobody has agreed to flatters the
    // number, and a forecast that flatters is worse than none.
    const openQuotes = await db.select().from(quotesTable).where(and(
      eq(quotesTable.tenantId, tenantId),
      eq(quotesTable.status, "Sent"),
    ));

    let countedOn = 0, overdue = 0;
    const buckets = new Map<number, { in: number; out: number }>();
    for (let w = 0; w < weeks; w++) buckets.set(w, { in: 0, out: 0 });

    const now = new Date();
    const weekIndex = (d: Date) => Math.floor((d.getTime() - now.getTime()) / (7 * 86400000));

    for (const inv of open) {
      const due = Math.max(0, pence(inv.total) - pence(inv.amountPaid));
      countedOn += due;
      const dueDate = inv.dueOn ? new Date(`${inv.dueOn}T00:00:00Z`) : null;
      if (dueDate && dueDate < now) {
        overdue += due;
        const b = buckets.get(0); if (b) b.in += due;   // treat as collectable now
      } else if (dueDate) {
        const w = weekIndex(dueDate);
        if (w >= 0 && w < weeks) { const b = buckets.get(w); if (b) b.in += due; }
      }
    }

    // Weekly run-rate from 90 days of actual spend, spread evenly. Crude, honest,
    // and better than pretending we know which week a bill lands in.
    const spend90 = recentSpend.reduce((s, e) => s + pence(e.total), 0);
    const weeklyOut = Math.round(spend90 / 13);
    let goingOut = 0;
    for (let w = 0; w < weeks; w++) { const b = buckets.get(w)!; b.out += weeklyOut; goingOut += weeklyOut; }

    const bookedValue = 0; // Projects carry no value column; counted as zero rather than invented.
    const notCounted = openQuotes.reduce((s, q) => s + pence(q.total), 0);

    res.json({
      weeks,
      basis: "Known money only — invoices, expenses and booked work you have already entered. No bank feed.",
      safeToSpend: money(countedOn - goingOut),
      countedOn: money(countedOn),
      goingOut: money(goingOut),
      overdue: money(overdue),
      notCounted: money(notCounted),
      notCountedLabel: `${openQuotes.length} ${openQuotes.length === 1 ? "quote" : "quotes"} without a job yet`,
      bookedJobs: booked.length,
      series: Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([w, v]) => {
        const start = new Date(now); start.setDate(start.getDate() + w * 7);
        return { week: w, weekStart: start.toISOString().slice(0, 10), in: money(v.in), out: money(v.out), net: money(v.in - v.out) };
      }),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * VAT position.
 *
 * Rolling 12-month taxable turnover against the registration threshold. Counts
 * paid invoices only, net of VAT — which is what the threshold actually measures,
 * and what stops an unpaid invoice pushing someone into registering early.
 */
const VAT_THRESHOLD = 90000; // £90,000, from 1 April 2024.

router.get("/money/vat-position", requireTenantAccess, async (req: any, res) => {
  try {
    const tenantId = tid(req);
    const [settings] = await db.select().from(tenantSettingsTable)
      .where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);

    const paid = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, tenantId),
      eq(invoicesTable.status, "paid"),
      sql`${invoicesTable.paidAt} >= (now() - INTERVAL '12 months')`,
    ));

    const turnover = paid.reduce((s, i) => s + pence(i.subtotal), 0);
    const registered = !!(settings as any)?.vatRegistered;
    const pct = Math.min(100, Math.round((turnover / 100 / VAT_THRESHOLD) * 1000) / 10);

    res.json({
      registered,
      threshold: VAT_THRESHOLD.toFixed(2),
      rollingTurnover: money(turnover),
      percentOfThreshold: pct,
      headroom: money(Math.max(0, VAT_THRESHOLD * 100 - turnover)),
      basis: "Net turnover from paid invoices over the last 12 months. No HMRC connection needed.",
      note: registered
        ? "You are registered for VAT, so this is for information only."
        : pct >= 80
          ? "You are approaching the registration threshold. Worth a word with your accountant."
          : "Comfortably below the registration threshold.",
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
