import { cn } from "@/lib/utils";

/**
 * The state vocabulary: one pill, used the same way everywhere.
 *
 * Ported from LaunchOS, including the reason it looks like this. The pill is
 * **solid** — saturated ground, white label — not a pale tint. A state has to be
 * readable at a glance down a column of thirty rows, and a washed-out pill is
 * what makes a screen feel provisional. BizzFlow had two competing pale-tint
 * pills (`Badge` in DashboardApp, `Pill` in TradePages) whose tones nobody could
 * distinguish at a glance: blue-100 "New" beside indigo-100 "Contacted" beside
 * amber-100 "Quote Sent".
 *
 * The word is always present, so the state survives a greyscale print and a
 * colour-blind reader is never relying on hue alone.
 *
 * Grounds carry white with the ratio calculated, not judged: neutral 7.77,
 * info 5.83, warning 6.76, danger 7.23, success 6.57.
 */
const TONES = {
  neutral: "bg-state-neutral text-white",
  info: "bg-state-info text-white",
  warn: "bg-state-warning text-white",
  danger: "bg-state-danger text-white",
  success: "bg-state-success text-white",
} as const;

export type StatusTone = keyof typeof TONES;

/**
 * The map every screen shares. Deliberately exhaustive rather than clever: a
 * value that lands here with no entry reads `neutral`, which is the safe
 * direction — a calm pill for an unknown state, never a false alarm.
 *
 * Keys are normalised (lowercase, underscores) so the older Title Case display
 * strings — "Quote Sent", "Survey Booked" — and the newer stored lowercase
 * values both resolve to the same tone without either side being rewritten.
 */
const TONE_BY_VALUE: Record<string, StatusTone> = {
  // leads
  new: "info",
  contacted: "info",
  survey_booked: "info",
  quote_sent: "warn",
  quote_approved: "success",
  won: "success",
  lost: "neutral",
  enquiry: "neutral",

  // quotes
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  declined: "danger",
  expired: "warn",

  // invoices — the money states, where a wrong tone costs real money
  unpaid: "warn",
  part_paid: "warn",
  paid: "success",
  overdue: "danger",
  void: "neutral",

  // jobs and the schedule
  scheduled: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
  unassigned: "warn",

  // certificates
  issued: "success",
  valid: "success",
  due: "warn",
  due_soon: "warn",
  superseded: "neutral",

  // automation runs. `skipped` is not an error — nobody switched the rule on —
  // so it stays neutral. An amber pill on a run that was never meant to happen
  // is the warning-everywhere problem.
  queued: "info",
  running: "info",
  succeeded: "success",
  failed: "danger",
  skipped: "neutral",

  // generic on/off
  active: "success",
  on: "success",
  off: "neutral",
  paused: "warn",
  suspended: "danger",
  archived: "neutral",
};

/** "Quote Sent" and "quote_sent" are the same state. */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * The stored value is a database word; the label is English. Title Case coming
 * in is left as it is — those are already display strings.
 */
function humanise(value: string): string {
  return value.includes("_") ? value.replaceAll("_", " ") : value;
}

export function StatusBadge({
  value,
  tone,
  label,
  className,
}: {
  value: string;
  tone?: StatusTone;
  /** Override the words without changing which colour the value maps to. */
  label?: string;
  className?: string;
}) {
  const resolved = tone ?? TONE_BY_VALUE[normalise(value)] ?? "neutral";
  return (
    <span
      data-status={value}
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold whitespace-nowrap capitalize",
        TONES[resolved],
        className,
      )}
    >
      <span className="truncate">{label ?? humanise(value)}</span>
    </span>
  );
}
