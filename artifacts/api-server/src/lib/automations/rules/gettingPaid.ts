import { z } from "zod/v4";
import { db, invoicesTable, projectsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logger } from "../../logger";
import { type AutomationRule, latestStepPassed, parseDayList } from "../types";
import { automationEmail, customerRecipient, notifyCustomer, tenantVoice } from "../notify";

const PLATFORM_BASE_URL = process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com";

export const chaseUnpaidInvoices: AutomationRule = {
  key: "chase_unpaid_invoices",
  group: "Getting paid",
  label: "Chase unpaid invoices",
  description:
    "Reminders under your name once an invoice is overdue. They stop the moment it is paid.",
  requires: "invoices",
  configSchema: z.object({
    days: z.union([z.array(z.number()), z.string()]),
  }),
  defaults: { days: [3, 7, 14] },
  setup: [
    { key: "days", label: "Days after the due date to chase", type: "text", hint: "e.g. 3, 7, 14" },
  ],
  async run(ctx) {
    const days = parseDayList(ctx.config.days, [3, 7, 14]);
    const { sendInvoiceEmail } = await import("../../invoices/deliver");

    const due = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, ctx.tenantId),
      inArray(invoicesTable.status, ["sent", "part_paid", "overdue"]),
      sql`${invoicesTable.dueOn} < CURRENT_DATE`,
    )).limit(200);

    let done = 0;
    for (const inv of due) {
      if (!inv.dueOn) continue;
      const overdueDays = Math.floor((Date.now() - new Date(`${inv.dueOn}T00:00:00Z`).getTime()) / 86400000);

      const step = latestStepPassed(days, overdueDays);
      if (step === undefined) continue;

      const ok = await ctx.act({
        subjectType: "invoice",
        subjectId: inv.id,
        summary: `Chased invoice ${inv.reference} — ${overdueDays} days overdue`,
        step: `day-${step}`,
      });
      if (!ok) continue;

      await sendInvoiceEmail(inv.id, ctx.tenantId, "chase").catch(e =>
        logger.error({ err: e, invoiceId: inv.id }, "Invoice chase email failed"));
      await db.update(invoicesTable)
        .set({ lastChasedAt: new Date(), chaseCount: (inv.chaseCount ?? 0) + 1 })
        .where(eq(invoicesTable.id, inv.id));
      done++;
    }
    return done;
  },
};

/**
 * Ask for the review once the money has landed.
 *
 * There is already a review request that fires when a job is marked complete.
 * This is the better moment and worth having as well: "complete" is a status a
 * trade sets on their own phone, often before the invoice is even raised, and
 * asking for five stars while the customer still has a bill coming is asking
 * them to review the work before they have seen the price. Paid in full means
 * the job is genuinely closed and nobody is annoyed.
 *
 * A couple of days of grace by default. Same hour as the bank transfer clears
 * is too eager, and reads as automated because it is.
 */
export const reviewWhenPaid: AutomationRule = {
  key: "review_when_paid",
  group: "Getting paid",
  label: "Ask for a review once they have paid",
  description:
    "A short thank-you and a review link, a few days after an invoice is settled in full. "
    + "Asking when the money has landed beats asking when the job is marked done — the customer has seen the price and is not waiting on anything.",
  requires: "invoices",
  needs: "A review link in Settings, or your Google Place ID.",
  configSchema: z.object({
    daysAfter: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
  defaults: {
    daysAfter: 2,
    message: "Thanks for having us out — it was good to meet you. If you have a spare minute, a short review really does help people find us.",
  },
  setup: [
    { key: "daysAfter", label: "Days after payment to ask", type: "number", hint: "2 or 3 works best. The same hour the money lands reads as a robot." },
    { key: "message", label: "What it says", type: "textarea", hint: "Your words, under your name." },
  ],
  async run(ctx) {
    const voice = await tenantVoice(ctx.tenantId);
    if (!voice) return 0;

    /**
     * Where the review goes.
     *
     * A tenant's own review link wins. Failing that, a Google Place ID builds
     * the direct "write a review" URL, which is the one that actually opens
     * the box rather than the listing. With neither, there is nowhere to send
     * anybody, and sending a review request with no link is worse than sending
     * nothing — so the rule does nothing and says so in the log.
     */
    const s = voice.settings ?? {};
    const reviewUrl = s.reviewPlatformUrl
      || (s.googlePlaceId ? `https://search.google.com/local/writereview?placeid=${s.googlePlaceId}` : null);
    if (!reviewUrl) {
      logger.info({ tenantId: ctx.tenantId }, "review_when_paid: no review link set, nothing sent");
      return 0;
    }

    const daysAfter = Math.max(0, Number(ctx.config.daysAfter ?? 2) || 0);
    const message = String(ctx.config.message ?? "").trim()
      || "Thanks for having us out. If you have a spare minute, a short review really does help people find us.";

    const paid = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, ctx.tenantId),
      eq(invoicesTable.status, "paid"),
      sql`${invoicesTable.paidAt} IS NOT NULL`,
      sql`${invoicesTable.paidAt} <= (now() - ${daysAfter} * INTERVAL '1 day')`,
      // A window, not all of history. Without it, switching this on would ask
      // every customer the business has ever had for a review on day one —
      // which is both a spam complaint and a very obvious pattern to Google.
      sql`${invoicesTable.paidAt} >= (now() - INTERVAL '45 days')`,
    )).limit(100);

    let done = 0;
    for (const inv of paid) {
      const to = await customerRecipient(inv.customerId);
      if (!to?.email && !to?.phone) continue;

      const ok = await ctx.act({
        subjectType: "invoice",
        subjectId: inv.id,
        summary: `Asked ${to.firstName} for a review after invoice ${inv.reference} was paid`,
      });
      if (!ok) continue;

      const sent = await notifyCustomer({
        tenantId: ctx.tenantId,
        voice,
        to,
        event: "review_request_paid",
        subject: `Thank you from ${voice.name}`,
        html: automationEmail(voice, {
          greeting: `Hi ${to.firstName},`,
          body: [message],
          cta: { label: "Leave a review", url: reviewUrl },
        }),
        sms: `Hi ${to.firstName}, thanks again from ${voice.name}. If you have a minute, a quick review helps us a lot: ${reviewUrl}`,
      });
      if (sent) done++;
    }
    return done;
  },
};

/**
 * Chase a merchant who has not delivered.
 *
 * Not a customer-facing rule — this one is for the trade. A job that cannot
 * start because the parts have not turned up is the most expensive kind of
 * empty day, and the thing that causes it is nobody remembering to ring the
 * merchant on the day it was promised.
 *
 * It raises the flag rather than emailing the supplier. A merchant chase is a
 * phone call in a particular tone by somebody who knows the account, and a
 * generated email would be ignored in a way a call is not.
 */
export const chaseLateDeliveries: AutomationRule = {
  key: "chase_late_deliveries",
  group: "Supplies",
  label: "Flag late deliveries",
  description:
    "Anything ordered that was promised by now and has not been marked as arrived shows up as a task, "
    + "with the job it is holding up. It flags it for you rather than emailing the merchant — that is a phone call, not a template.",
  requires: "expenses",
  configSchema: z.object({ graceDays: z.union([z.number(), z.string()]).optional() }),
  defaults: { graceDays: 1 },
  setup: [
    { key: "graceDays", label: "Days past the promised date before flagging", type: "number", hint: "1 is usually right. 0 flags things that are merely on the van." },
  ],
  async run(ctx) {
    const { expensesTable } = await import("@workspace/db");
    const grace = Math.max(0, Number(ctx.config.graceDays ?? 1) || 0);

    const late = await db.select().from(expensesTable).where(and(
      eq(expensesTable.tenantId, ctx.tenantId),
      sql`${expensesTable.expectedOn} IS NOT NULL`,
      sql`${expensesTable.receivedOn} IS NULL`,
      sql`${expensesTable.expectedOn} < (CURRENT_DATE - ${grace} * INTERVAL '1 day')`,
    )).limit(100);

    let done = 0;
    for (const order of late) {
      const overdue = Math.floor(
        (Date.now() - new Date(`${order.expectedOn}T00:00:00Z`).getTime()) / 86400000,
      );

      let holdingUp = "";
      if (order.projectId) {
        const [job] = await db.select({ title: projectsTable.title, start: projectsTable.scheduledStart })
          .from(projectsTable).where(eq(projectsTable.id, order.projectId)).limit(1);
        if (job) {
          holdingUp = ` — holding up "${job.title}"${
            job.start ? ` on ${new Date(job.start).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}`;
        }
      }

      // Stepped so a delivery that is a fortnight late is flagged again rather
      // than going quiet after the first mention.
      const step = latestStepPassed([0, 3, 7, 14], overdue);
      const ok = await ctx.act({
        subjectType: "expense",
        subjectId: order.id,
        summary: `${order.supplier} is ${overdue} day${overdue === 1 ? "" : "s"} late${holdingUp}`,
        step: `day-${step ?? 0}`,
      });
      if (ok) done++;
    }
    return done;
  },
};
