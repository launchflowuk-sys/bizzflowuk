import { z } from "zod/v4";
import {
  db, certificatesTable, customersTable, leadsTable, quotesTable, quoteItemsTable,
  projectsTable, servicesTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type AutomationRule, latestStepPassed, parseDayList } from "../types";
import { customerRecipient } from "../notify";

export const certificateRenewals: AutomationRule = {
  key: "certificate_renewals",
  group: "Compliance",
  label: "Certificate renewal reminders",
  description:
    "A renewal lands in your leads before each certificate runs out, so next year's work books itself.",
  requires: "certificates",
  configSchema: z.object({ days: z.union([z.array(z.number()), z.string()]) }),
  // Two touches rather than one window: far enough out to plan, close enough to act.
  defaults: { days: [42, 14] },
  setup: [
    { key: "days", label: "Days before expiry to raise the renewal", type: "text", hint: "e.g. 42, 14" },
  ],
  async run(ctx) {
    const days = parseDayList(ctx.config.days, [42, 14]);
    const widest = Math.max(...days);

    const due = await db.select().from(certificatesTable).where(and(
      eq(certificatesTable.tenantId, ctx.tenantId),
      eq(certificatesTable.status, "issued"),
      isNull(certificatesTable.supersededById),
      sql`${certificatesTable.expiresAt} <= (CURRENT_DATE + ${widest} * INTERVAL '1 day')`,
    )).limit(300);

    let done = 0;
    for (const cert of due) {
      const daysLeft = Math.ceil((new Date(`${cert.expiresAt}T00:00:00Z`).getTime() - Date.now()) / 86400000);
      const step = [...days].sort((a, b) => b - a).filter(d => daysLeft <= d).pop();
      if (step === undefined) continue;

      const ok = await ctx.act({
        subjectType: "certificate",
        subjectId: cert.id,
        summary: `Renewal raised for ${cert.reference} — due ${cert.expiresAt}`,
        step: `day-${step}`,
      });
      if (!ok) continue;

      let firstName = cert.landlordName || "Renewal due";
      let lastName = "", email: string | null = null, phone: string | null = null;
      if (cert.customerId) {
        const [cust] = await db.select().from(customersTable).where(eq(customersTable.id, cert.customerId)).limit(1);
        if (cust) {
          firstName = cust.firstName || firstName;
          lastName = cust.lastName || "";
          email = cust.email ?? null;
          phone = cust.phone ?? null;
        }
      }

      await db.insert(leadsTable).values({
        tenantId: ctx.tenantId,
        reference: `REN-${cert.reference}-${step}`,
        status: "New",
        source: "Renewal",
        serviceInterest: "Certificate renewal",
        firstName, lastName, email, phone,
        address: cert.propertyAddress,
        postcode: cert.propertyPostcode,
        notes: `Certificate ${cert.reference} expires ${cert.expiresAt} (${daysLeft} days). Renews the record checked ${cert.checkedAt}.`,
      });

      await db.update(certificatesTable)
        .set({ renewalNotifiedAt: new Date() })
        .where(eq(certificatesTable.id, cert.id));
      done++;
    }
    return done;
  },
};

/**
 * Have next year's quote already written.
 *
 * The renewal reminder above produces a lead, which still leaves somebody to
 * price it. For a job that is identical to last year's — a gas safety check on
 * the same property — that pricing is retyping, and retyping is what does not
 * get done on a Friday afternoon.
 *
 * So this drafts the quote off last year's, at last year's price, and leaves it
 * as a DRAFT. It never sends. The price may need to move, and a quote going out
 * at a stale figure is worse than a quote that went out late.
 */
export const draftRenewalQuotes: AutomationRule = {
  key: "draft_renewal_quotes",
  group: "Compliance",
  label: "Have next year's quote already drafted",
  description:
    "When a certificate is coming up for renewal, last year's quote is copied into a fresh draft at "
    + "last year's figures. It never sends — you check the price and press send.",
  requires: "certificates",
  configSchema: z.object({
    daysBefore: z.union([z.number(), z.string()]).optional(),
    uplift: z.union([z.number(), z.string()]).optional(),
  }),
  defaults: { daysBefore: 42, uplift: 0 },
  setup: [
    { key: "daysBefore", label: "Days before expiry to draft it", type: "number", hint: "Same as your renewal reminder usually makes sense." },
    { key: "uplift", label: "Put the price up by (%)", type: "number", hint: "0 keeps last year's figure. It is a draft either way." },
  ],
  async run(ctx) {
    const daysBefore = Math.max(1, Number(ctx.config.daysBefore ?? 42) || 42);
    const uplift = Number(ctx.config.uplift ?? 0) || 0;

    const due = await db.select().from(certificatesTable).where(and(
      eq(certificatesTable.tenantId, ctx.tenantId),
      eq(certificatesTable.status, "issued"),
      isNull(certificatesTable.supersededById),
      sql`${certificatesTable.expiresAt} <= (CURRENT_DATE + ${daysBefore} * INTERVAL '1 day')`,
      sql`${certificatesTable.expiresAt} >= CURRENT_DATE`,
      sql`${certificatesTable.customerId} IS NOT NULL`,
    )).limit(100);

    let done = 0;
    for (const cert of due) {
      // Last year's quote for this customer, which is the thing being copied.
      // No previous quote means nothing to base a price on, and inventing one
      // is exactly what this rule must not do.
      const [previous] = await db.select().from(quotesTable).where(and(
        eq(quotesTable.tenantId, ctx.tenantId),
        eq(quotesTable.customerId, cert.customerId!),
        sql`${quotesTable.status} IN ('Accepted', 'Sent')`,
      )).orderBy(sql`${quotesTable.createdAt} desc`).limit(1);
      if (!previous) continue;

      const ok = await ctx.act({
        subjectType: "certificate",
        subjectId: cert.id,
        summary: `Drafted a renewal quote for ${cert.reference}, based on ${previous.reference}`,
      });
      if (!ok) continue;

      const items = await db.select().from(quoteItemsTable)
        .where(eq(quoteItemsTable.quoteId, previous.id))
        .orderBy(quoteItemsTable.sortOrder);

      const factor = 1 + uplift / 100;
      const priced = items.map(i => {
        const unit = Number(i.unitPrice) * factor;
        const qty = Number(i.quantity ?? 1);
        return {
          description: i.description,
          quantity: String(qty),
          unitPrice: unit.toFixed(2),
          total: (Math.round(unit * 100) * qty / 100).toFixed(2),
          sortOrder: i.sortOrder,
        };
      });
      const subtotal = priced.reduce((s, i) => s + Number(i.total), 0);

      const [draft] = await db.insert(quotesTable).values({
        tenantId: ctx.tenantId,
        customerId: cert.customerId,
        reference: `${previous.reference}-R`,
        status: "Draft",
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        notes: `Renewal of ${cert.reference}, which expires ${cert.expiresAt}. Copied from ${previous.reference}${uplift ? ` with ${uplift}% added` : " at the same price"}. Check the figure before sending.`,
      }).returning();

      if (priced.length) {
        await db.insert(quoteItemsTable).values(priced.map(i => ({ ...i, quoteId: draft.id })));
      }
      done++;
    }
    return done;
  },
};

/**
 * Book the visit that comes round again.
 *
 * A boiler service, an annual check, a quarterly clean: the work a trade
 * genuinely relies on, and the work that quietly stops happening because
 * nobody writes it down.
 *
 * It only fires for services the tenant has MARKED as recurring (migration
 * 0048). Guessing from the job title is how somebody gets asked to rebook the
 * bathroom they had done last year.
 */
export const recurringVisitReminders: AutomationRule = {
  key: "recurring_visits",
  group: "Compliance",
  label: "Remind customers when a visit is due again",
  description:
    "Services you have marked as recurring raise a lead when they come round — an annual boiler service, "
    + "a quarterly clean. Set the interval on the service itself and it looks after the rest.",
  needs: "At least one service with a repeat interval set on it.",
  configSchema: z.object({ daysBefore: z.union([z.number(), z.string()]).optional() }),
  defaults: { daysBefore: 30 },
  setup: [
    { key: "daysBefore", label: "Days before it is due to raise the lead", type: "number", hint: "30 gives you a month to get it in the diary." },
  ],
  async run(ctx) {
    const daysBefore = Math.max(1, Number(ctx.config.daysBefore ?? 30) || 30);

    /**
     * A completed job, on a service with an interval, whose next visit falls
     * inside the window — and where the customer has nothing already booked.
     *
     * The interval is counted from completion, not from the booking, because
     * what comes round again is the work, not the appointment that slipped.
     */
    const rows = await db.select({
      job: projectsTable,
      serviceName: servicesTable.name,
      months: servicesTable.recursEveryMonths,
    }).from(projectsTable)
      .innerJoin(servicesTable, eq(servicesTable.id, projectsTable.serviceId))
      .where(and(
        eq(projectsTable.tenantId, ctx.tenantId),
        eq(projectsTable.status, "Completed"),
        sql`${projectsTable.completedAt} IS NOT NULL`,
        sql`${servicesTable.recursEveryMonths} IS NOT NULL`,
        sql`(${projectsTable.completedAt} + (${servicesTable.recursEveryMonths} * INTERVAL '1 month'))
             <= (now() + ${daysBefore} * INTERVAL '1 day')`,
        // Not indefinitely overdue: a job finished four years ago on a yearly
        // service should not produce four leads the day this is switched on.
        sql`(${projectsTable.completedAt} + (${servicesTable.recursEveryMonths} * INTERVAL '1 month'))
             >= (now() - INTERVAL '60 days')`,
      )).limit(100);

    let done = 0;
    for (const { job, serviceName, months } of rows) {
      if (!job.customerId || !months) continue;

      const [openJob] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(
        eq(projectsTable.customerId, job.customerId),
        eq(projectsTable.serviceId, job.serviceId!),
        sql`${projectsTable.status} <> 'Completed'`,
      )).limit(1);
      if (openJob) continue;

      const dueOn = new Date(job.completedAt!);
      dueOn.setMonth(dueOn.getMonth() + months);
      const dueText = dueOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const to = await customerRecipient(job.customerId);

      const ok = await ctx.act({
        subjectType: "project",
        subjectId: job.id,
        summary: `${serviceName} is due again for ${to?.firstName ?? "a customer"} on ${dueText}`,
      });
      if (!ok) continue;

      await db.insert(leadsTable).values({
        tenantId: ctx.tenantId,
        reference: `REC-${job.id}`,
        status: "New",
        source: "Recurring",
        serviceInterest: serviceName,
        firstName: to?.firstName ?? "Due again",
        lastName: "",
        email: to?.email ?? null,
        phone: to?.phone ?? null,
        address: job.address,
        postcode: job.postcode,
        notes: `${serviceName} is due again on ${dueText}, ${months} months after "${job.title}" was completed.`,
      });
      done++;
    }
    return done;
  },
};
