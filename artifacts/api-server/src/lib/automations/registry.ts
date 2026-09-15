import { z } from "zod/v4";
import { AUTOMATION_GROUPS, type AutomationRule } from "./types";
import { chaseUnpaidInvoices, reviewWhenPaid, chaseLateDeliveries } from "./rules/gettingPaid";
import { appointmentReminders, sendPaperwork } from "./rules/onTheDay";
import { followUpQuotes, photosBeforeQuote, chaseRepeatWork } from "./rules/winningWork";
import { certificateRenewals, draftRenewalQuotes, recurringVisitReminders } from "./rules/compliance";

/**
 * The automation catalogue.
 *
 * Assembly only — the rules themselves live in ./rules, grouped by the moment
 * in the week they belong to. Adding one is an entry in a file and a line in
 * the array below; there is no branch on tenant anywhere in the engine, and a
 * rule never knows which business it is acting for beyond the id it is handed.
 *
 * The shape and the two standing promises are in ./types.
 */

export {
  type AutomationRule, type RuleContext, makeContext,
  AUTOMATION_GROUPS, type AutomationGroup,
} from "./types";

/**
 * Text back a missed call.
 *
 * Listed but not switchable, and that is deliberate.
 *
 * It is genuinely the most valuable automation on this page — a missed call at
 * eleven in the morning while you are under a sink is a job that goes to
 * whoever answers next, and a text back inside a minute usually keeps it. But
 * it cannot be built the way the rest of these are. It needs a real phone
 * number the business's calls divert through, which means a Twilio number per
 * tenant, call forwarding set up on their mobile, and a per-minute bill that
 * somebody pays every month whether or not anyone rings.
 *
 * So it sits here as a card that says what it does and that it needs setting
 * up, rather than as a switch that quietly does nothing. A switch that looks
 * live and is not is how a trade loses a job while believing the software has
 * it covered.
 */
const textBackMissedCalls: AutomationRule = {
  key: "text_back_missed_calls",
  group: "Winning work",
  label: "Text back a missed call",
  description:
    "A missed call while you are under a sink is a job that goes to whoever answers next. "
    + "This texts them straight back so it does not.",
  needs:
    "A phone number of your own that your calls divert through, and a monthly line rental. "
    + "Ask us to set it up and we will quote you for it — it is not something we can switch on from here.",
  configSchema: z.object({}),
  defaults: {},
  setup: [],
  // Never runs. Present so the card exists, honestly, with its own switch off.
  async run() { return 0; },
};

const ALL: AutomationRule[] = [
  // Winning work
  followUpQuotes,
  chaseRepeatWork,
  textBackMissedCalls,
  // Before the job
  photosBeforeQuote,
  // On the day
  appointmentReminders,
  // After the job
  sendPaperwork,
  // Getting paid
  chaseUnpaidInvoices,
  reviewWhenPaid,
  // Compliance
  certificateRenewals,
  draftRenewalQuotes,
  recurringVisitReminders,
  // Supplies
  chaseLateDeliveries,
];

/** Rules that are shown but can never run. Kept out of the sweep entirely. */
const NOT_RUNNABLE = new Set(["text_back_missed_calls"]);

const REGISTRY: Record<string, AutomationRule> = {};
for (const rule of ALL) REGISTRY[rule.key] = rule;

export function getRule(key: string): AutomationRule | null {
  if (NOT_RUNNABLE.has(key)) return null;
  return REGISTRY[key] ?? null;
}

export function listRules(): AutomationRule[] {
  return ALL;
}

/** Shape the dashboard needs. Zod schemas stay server-side. */
export function describeRules() {
  return ALL.map(r => ({
    key: r.key,
    group: r.group,
    label: r.label,
    description: r.description,
    defaults: r.defaults,
    setup: r.setup,
    requires: r.requires ?? null,
    needs: r.needs ?? null,
    // The page renders groups in this order rather than alphabetically, so it
    // reads as a week: winning it, doing it, getting paid for it.
    groupOrder: AUTOMATION_GROUPS.indexOf(r.group),
    available: !NOT_RUNNABLE.has(r.key),
  }));
}
