import { z } from "zod/v4";
import { db, quotesTable, customersTable, leadsTable, projectsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { type AutomationRule, latestStepPassed, parseDayList } from "../types";
import { automationEmail, customerRecipient, notifyCustomer, tenantVoice } from "../notify";
import { resolveQuoteRecipient } from "../../../routes/quotes";

/**
 * Nudge a quote nobody has answered.
 *
 * This rule existed before and did not send anything. It wrote a row saying it
 * had followed up, incremented the counter, and stopped — so the dashboard
 * reported nudges that no customer ever received, which is the worst kind of
 * broken: it looks like it is working. It sends now.
 */
export const followUpQuotes: AutomationRule = {
  key: "follow_up_quotes",
  group: "Winning work",
  label: "Follow up on quotes",
  description: "A nudge to anyone who has not answered a quote. It stops the moment they reply or accept.",
  configSchema: z.object({
    days: z.union([z.array(z.number()), z.string()]),
    message: z.string().optional(),
  }),
  defaults: {
    days: [3, 10],
    message: "Just checking you got the quote through and whether you had any questions. Happy to talk it over — no pressure either way.",
  },
  setup: [
    { key: "days", label: "Days after sending to follow up", type: "text", hint: "e.g. 3, 10" },
    { key: "message", label: "What it says", type: "textarea", hint: "Your words. Short and un-pushy wins more work than a hard sell." },
  ],
  async run(ctx) {
    const voice = await tenantVoice(ctx.tenantId);
    if (!voice) return 0;

    const days = parseDayList(ctx.config.days, [3, 10]);
    const widest = Math.max(...days);
    const message = String(ctx.config.message ?? "").trim()
      || "Just checking you got the quote through and whether you had any questions.";

    const open = await db.select().from(quotesTable).where(and(
      eq(quotesTable.tenantId, ctx.tenantId),
      eq(quotesTable.status, "Sent"),
      sql`${quotesTable.sentAt} IS NOT NULL`,
      sql`${quotesTable.sentAt} >= (now() - ${widest + 30} * INTERVAL '1 day')`,
    )).limit(200);

    let done = 0;
    for (const q of open) {
      if (!q.sentAt) continue;
      const age = Math.floor((Date.now() - new Date(q.sentAt).getTime()) / 86400000);
      const step = latestStepPassed(days, age);
      if (step === undefined) continue;

      // resolveQuoteRecipient is the one place that knows where a quote's
      // person lives — it may be a customer, or a lead that never became one.
      //
      // Its fields are customerEmail / customerPhone, NOT email / phone.
      // Reading the wrong names gives undefined on every quote, which would
      // have reproduced exactly the bug this rule is being fixed for: a
      // follow-up that logs itself and reaches nobody.
      const who = await resolveQuoteRecipient(q);
      const email = who.customerEmail ?? null;
      const phone = who.customerPhone ?? null;
      const firstName = who.firstName || "there";
      if (!email) continue;

      const ok = await ctx.act({
        subjectType: "quote",
        subjectId: q.id,
        summary: `Followed up quote ${q.reference} with ${firstName} — sent ${age} days ago`,
        step: `day-${step}`,
      });
      if (!ok) continue;

      const sent = await notifyCustomer({
        tenantId: ctx.tenantId,
        voice,
        to: { firstName, email, phone },
        event: "quote_follow_up",
        subject: `About your quote ${q.reference}`,
        html: automationEmail(voice, {
          greeting: `Hi ${firstName},`,
          body: [message, `The quote reference is <strong>${q.reference}</strong>, for £${Number(q.total ?? 0).toFixed(2)}.`],
        }),
      });
      if (sent) done++;
    }
    return done;
  },
};

/**
 * Ask for photos before quoting.
 *
 * A trade who quotes from three photos instead of driving out saves an hour and
 * a tank of diesel per enquiry, and the customer gets a price the same day
 * rather than next week. The ones who will not send photos were usually going
 * to be hard work anyway.
 *
 * Deliberately worded as a request, not a condition. "Send photos or we will
 * not quote" loses the job; "a couple of photos and I can usually price it
 * today" wins it.
 */
export const photosBeforeQuote: AutomationRule = {
  key: "photos_before_quote",
  group: "Before the job",
  label: "Ask for photos before quoting",
  description:
    "New enquiries get a short message asking for a couple of photos. "
    + "Quoting off photos saves a visit on the ones that were never going to be worth the drive.",
  configSchema: z.object({
    hoursAfter: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
  defaults: {
    hoursAfter: 1,
    message: "Thanks for getting in touch. If you can send a couple of photos of the job — and a wider one showing the space — I can usually give you a price without needing to come out.",
  },
  setup: [
    { key: "hoursAfter", label: "Hours after the enquiry arrives", type: "number", hint: "An hour feels prompt without looking automated." },
    { key: "message", label: "What it says", type: "textarea" },
  ],
  async run(ctx) {
    const voice = await tenantVoice(ctx.tenantId);
    if (!voice) return 0;

    const hours = Math.max(0, Number(ctx.config.hoursAfter ?? 1) || 0);
    const message = String(ctx.config.message ?? "").trim()
      || "If you can send a couple of photos of the job, I can usually give you a price without needing to come out.";

    const fresh = await db.select().from(leadsTable).where(and(
      eq(leadsTable.tenantId, ctx.tenantId),
      eq(leadsTable.status, "New"),
      sql`${leadsTable.createdAt} <= (now() - ${hours} * INTERVAL '1 hour')`,
      // Only recent ones. Switching this on must not message every enquiry the
      // business has ever received.
      sql`${leadsTable.createdAt} >= (now() - INTERVAL '7 days')`,
    )).limit(100);

    let done = 0;
    for (const lead of fresh) {
      if (!lead.email && !lead.phone) continue;
      const firstName = lead.firstName || "there";

      const ok = await ctx.act({
        subjectType: "lead",
        subjectId: lead.id,
        summary: `Asked ${firstName} for photos of the job`,
      });
      if (!ok) continue;

      const sent = await notifyCustomer({
        tenantId: ctx.tenantId,
        voice,
        to: { firstName, email: lead.email, phone: lead.phone },
        event: "photos_requested",
        subject: `Your enquiry — a couple of photos would help`,
        html: automationEmail(voice, {
          greeting: `Hi ${firstName},`,
          body: [message, "Just reply to this email with them and I will come back to you."],
        }),
        sms: `Hi ${firstName}, ${voice.name} here. ${message} Just text them back to this number.`,
      });
      if (sent) done++;
    }
    return done;
  },
};

/**
 * Go back to customers who have gone quiet.
 *
 * The cheapest work a trade will ever get is from somebody who has already paid
 * them once and liked it. It is also the work that never happens, because
 * nobody sits down and goes through the customer list.
 *
 * Nine months by default: long enough that it does not read as touting, short
 * enough that they still remember who you are.
 */
export const chaseRepeatWork: AutomationRule = {
  key: "chase_repeat_work",
  group: "Winning work",
  label: "Go back to past customers",
  description:
    "Customers you have not worked for in a while get a short, friendly note. "
    + "The cheapest job you will ever win is from somebody who already paid you once and liked it.",
  configSchema: z.object({
    monthsQuiet: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  }),
  defaults: {
    monthsQuiet: 9,
    message: "It has been a while since we were out to you — I hope everything is still running well. If anything needs looking at, give me a shout.",
  },
  setup: [
    { key: "monthsQuiet", label: "Months since their last job", type: "number", hint: "9 to 12 is about right. Sooner than that reads as touting." },
    { key: "message", label: "What it says", type: "textarea" },
  ],
  async run(ctx) {
    const voice = await tenantVoice(ctx.tenantId);
    if (!voice) return 0;

    const months = Math.max(1, Number(ctx.config.monthsQuiet ?? 9) || 9);
    const message = String(ctx.config.message ?? "").trim()
      || "It has been a while since we were out to you. If anything needs looking at, give me a shout.";

    /**
     * Customers whose MOST RECENT completed job is older than the window, and
     * who have nothing on the books now.
     *
     * The "nothing booked" half matters: a customer with a job next Tuesday
     * getting "we have not seen you in a while" makes the business look like it
     * is not paying attention, which is the opposite of the point.
     */
    const quiet = await db.select({
      customerId: projectsTable.customerId,
      lastDone: sql<string>`max(${projectsTable.completedAt})`,
    }).from(projectsTable)
      .where(and(
        eq(projectsTable.tenantId, ctx.tenantId),
        eq(projectsTable.status, "Completed"),
        sql`${projectsTable.customerId} IS NOT NULL`,
      ))
      .groupBy(projectsTable.customerId)
      .having(sql`max(${projectsTable.completedAt}) < (now() - ${months} * INTERVAL '1 month')`)
      .limit(60);

    let done = 0;
    for (const row of quiet) {
      if (!row.customerId) continue;

      const [openJob] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(
        eq(projectsTable.customerId, row.customerId),
        sql`${projectsTable.status} <> 'Completed'`,
      )).limit(1);
      if (openJob) continue;

      const to = await customerRecipient(row.customerId);
      if (!to?.email && !to?.phone) continue;

      // Stepped by year, so a customer who stays quiet is asked again next year
      // rather than once and never again — but never twice in one year.
      const year = new Date().getFullYear();
      const ok = await ctx.act({
        subjectType: "customer",
        subjectId: row.customerId,
        summary: `Got back in touch with ${to.firstName} — last job ${new Date(row.lastDone).toLocaleDateString("en-GB")}`,
        step: `year-${year}`,
      });
      if (!ok) continue;

      const sent = await notifyCustomer({
        tenantId: ctx.tenantId,
        voice,
        to,
        event: "repeat_work",
        subject: `Hello from ${voice.name}`,
        html: automationEmail(voice, {
          greeting: `Hi ${to.firstName},`,
          body: [message],
        }),
        sms: `Hi ${to.firstName}, ${voice.name} here. ${message}`,
      });
      if (sent) done++;
    }
    return done;
  },
};
