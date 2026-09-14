import { z } from "zod/v4";
import { db } from "@workspace/db";
import {
  invoicesTable, certificatesTable, quotesTable, customersTable,
  automationRunsTable, leadsTable,
} from "@workspace/db";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { logger } from "../logger";

/**
 * The automation catalogue.
 *
 * A rule is a definition plus a `run` function. Adding one is an entry in this
 * file — there is no branch on tenant anywhere in the engine, and a rule never
 * knows which business it is acting for beyond the id it is handed.
 *
 * Two rules every one of these obeys:
 *
 *  1. Nothing sends until a tenant has enabled it and seen the wording. The
 *     `setup` questions are what the dashboard renders before the switch works.
 *  2. Every action is recorded in automation_runs before it is counted. That row
 *     is both the idempotency latch and the evidence for "BizzFlow did N things
 *     for you this month" — a claim that should be countable, not estimated.
 */

export type RuleContext = {
  tenantId: number;
  config: Record<string, unknown>;
  /** Records an action and returns false if this subject was already handled. */
  act: (args: {
    subjectType: string;
    subjectId: number;
    summary: string;
    /** Distinguishes repeat actions on one subject, e.g. chase #2 of 3. */
    step?: string;
  }) => Promise<boolean>;
};

export type AutomationRule = {
  key: string;
  group: "Winning work" | "Getting paid" | "On the day" | "Compliance";
  label: string;
  /** Plain description, in the operator's language, shown on the card. */
  description: string;
  /** Config shape, validated before the rule can be enabled. */
  configSchema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  /**
   * The questions asked before the switch works. Rendering these and showing a
   * preview is what makes a tradesperson comfortable turning it on.
   */
  setup: Array<{ key: string; label: string; type: "number" | "text" | "textarea" | "boolean"; hint?: string }>;
  /** Requires invoices, certificates etc. Hidden for tenants without the module. */
  requires?: string;
  run: (ctx: RuleContext) => Promise<number>;
};

/** Has this rule already acted on this subject (and step)? */
async function alreadyActed(tenantId: number, key: string, subjectType: string, subjectId: number, step?: string) {
  const rows = await db.select({ id: automationRunsTable.id, detail: automationRunsTable.detail })
    .from(automationRunsTable)
    .where(and(
      eq(automationRunsTable.tenantId, tenantId),
      eq(automationRunsTable.key, key),
      eq(automationRunsTable.subjectType, subjectType),
      eq(automationRunsTable.subjectId, subjectId),
      eq(automationRunsTable.outcome, "ok"),
    ));
  if (!step) return rows.length > 0;
  return rows.some(r => r.detail === step);
}

export function makeContext(tenantId: number, key: string, config: Record<string, unknown>): RuleContext {
  return {
    tenantId,
    config,
    async act({ subjectType, subjectId, summary, step }) {
      if (await alreadyActed(tenantId, key, subjectType, subjectId, step)) return false;
      await db.insert(automationRunsTable).values({
        tenantId, key, subjectType, subjectId, summary, outcome: "ok", detail: step ?? null,
      });
      return true;
    },
  };
}

// ── Getting paid ─────────────────────────────────────────────────────────────

const chaseUnpaidInvoices: AutomationRule = {
  key: "chase_unpaid_invoices",
  group: "Getting paid",
  label: "Chase unpaid invoices",
  description:
    "Reminders under your name once an invoice is overdue. They stop the moment it is paid.",
  requires: "invoices",
  configSchema: z.object({
    days: z.array(z.number().int().min(1).max(180)).min(1).max(6),
  }),
  defaults: { days: [3, 7, 14] },
  setup: [
    { key: "days", label: "Days after the due date to chase", type: "text", hint: "e.g. 3, 7, 14" },
  ],
  async run(ctx) {
    const days = (ctx.config.days as number[]) ?? [3, 7, 14];
    const { sendInvoiceEmail } = await import("../invoices/deliver");

    const due = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.tenantId, ctx.tenantId),
      inArray(invoicesTable.status, ["sent", "part_paid", "overdue"]),
      sql`${invoicesTable.dueOn} < CURRENT_DATE`,
    )).limit(200);

    let done = 0;
    for (const inv of due) {
      if (!inv.dueOn) continue;
      const overdueDays = Math.floor((Date.now() - new Date(`${inv.dueOn}T00:00:00Z`).getTime()) / 86400000);

      // The latest threshold passed, so an invoice that has sat unpaid for weeks
      // gets the right chase rather than all of them at once.
      const step = [...days].sort((a, b) => a - b).filter(d => overdueDays >= d).pop();
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

// ── Compliance ───────────────────────────────────────────────────────────────

const certificateRenewals: AutomationRule = {
  key: "certificate_renewals",
  group: "Compliance",
  label: "Certificate renewal reminders",
  description:
    "A renewal lands in your leads before each certificate runs out, so next year's work books itself.",
  requires: "certificates",
  configSchema: z.object({
    days: z.array(z.number().int().min(1).max(365)).min(1).max(4),
  }),
  // Two touches rather than one window: far enough out to plan, close enough to act.
  defaults: { days: [42, 14] },
  setup: [
    { key: "days", label: "Days before expiry to raise the renewal", type: "text", hint: "e.g. 42, 14" },
  ],
  async run(ctx) {
    const days = (ctx.config.days as number[]) ?? [42, 14];
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

// ── Winning work ─────────────────────────────────────────────────────────────

const followUpQuotes: AutomationRule = {
  key: "follow_up_quotes",
  group: "Winning work",
  label: "Follow up on quotes",
  description: "A nudge to anyone who has not answered a quote. It stops the moment they reply or accept.",
  configSchema: z.object({ days: z.array(z.number().int().min(1).max(90)).min(1).max(4) }),
  defaults: { days: [3, 10] },
  setup: [{ key: "days", label: "Days after sending to follow up", type: "text", hint: "e.g. 3, 10" }],
  async run(ctx) {
    const days = (ctx.config.days as number[]) ?? [3, 10];
    const widest = Math.max(...days);

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
      const step = [...days].sort((a, b) => a - b).filter(d => age >= d).pop();
      if (step === undefined) continue;

      const ok = await ctx.act({
        subjectType: "quote",
        subjectId: q.id,
        summary: `Followed up quote ${q.reference} — sent ${age} days ago`,
        step: `day-${step}`,
      });
      if (ok) done++;
    }
    return done;
  },
};

const REGISTRY: Record<string, AutomationRule> = {};
for (const rule of [chaseUnpaidInvoices, certificateRenewals, followUpQuotes]) {
  REGISTRY[rule.key] = rule;
}

export function getRule(key: string): AutomationRule | null {
  return REGISTRY[key] ?? null;
}

export function listRules(): AutomationRule[] {
  return Object.values(REGISTRY);
}

/** Shape the dashboard needs. Zod schemas stay server-side. */
export function describeRules() {
  return listRules().map(r => ({
    key: r.key,
    group: r.group,
    label: r.label,
    description: r.description,
    defaults: r.defaults,
    setup: r.setup,
    requires: r.requires ?? null,
  }));
}
