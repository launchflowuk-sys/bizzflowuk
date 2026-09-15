import { z } from "zod/v4";
import { db, automationRunsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * What an automation rule is.
 *
 * Split out of registry.ts when the catalogue went from three rules to
 * thirteen. A rule is a definition plus a `run` function, and adding one is an
 * entry in a file — there is no branch on tenant anywhere in the engine, and a
 * rule never knows which business it is acting for beyond the id it is handed.
 *
 * Two rules every one of these obeys:
 *
 *  1. Nothing sends until a tenant has enabled it and seen the wording. The
 *     `setup` questions are what the dashboard renders before the switch works.
 *  2. Every action is recorded in automation_runs BEFORE it is counted. That
 *     row is both the idempotency latch and the evidence for "BizzFlow did N
 *     things for you this month" — a claim that should be countable, not
 *     estimated.
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

/**
 * The headings on the automations page.
 *
 * Named for the moment in the week they belong to rather than for the part of
 * the system they touch, because a trade thinks "before the job" and "after
 * I've been paid", not "projects" and "invoices".
 */
export const AUTOMATION_GROUPS = [
  "Winning work",
  "Before the job",
  "On the day",
  "After the job",
  "Getting paid",
  "Compliance",
  "Supplies",
] as const;
export type AutomationGroup = (typeof AUTOMATION_GROUPS)[number];

export type AutomationRule = {
  key: string;
  group: AutomationGroup;
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
  /**
   * Named when the rule needs something the tenant has to configure elsewhere
   * before it can do anything — an SMS account, a review link. Shown on the
   * card so a switch that would silently do nothing says why instead.
   */
  needs?: string;
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

/**
 * The most recent threshold a subject has passed.
 *
 * Shared because five rules need the same thing: given [3, 7, 14] and an
 * invoice 9 days overdue, the answer is 7 — not all three at once, and not the
 * first one forever. Getting this wrong means a customer gets three emails in
 * one morning, which is the fastest way to have every automation switched off.
 */
export function latestStepPassed(steps: number[], elapsed: number): number | undefined {
  return [...steps].sort((a, b) => a - b).filter(d => elapsed >= d).pop();
}

/** Parses "3, 7, 14" from a text box into the numbers a rule expects. */
export function parseDayList(value: unknown, fallback: number[]): number[] {
  if (Array.isArray(value)) {
    const nums = value.map(Number).filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? nums : fallback;
  }
  if (typeof value === "string") {
    const nums = value.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? nums : fallback;
  }
  return fallback;
}
