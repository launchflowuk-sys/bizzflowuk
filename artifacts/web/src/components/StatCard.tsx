import { ArrowRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * A headline figure, as a dark saturated panel on the light canvas.
 *
 * Ported from LaunchOS, where the idea is spelled out in DESIGN.md: the
 * contrast IS the design. These sit above a page of white cards and read as the
 * important thing *because* everything around them is white. Darkening the rest
 * of the dashboard to match would destroy the only effect they exist for.
 *
 * What BizzFlow had instead was a row of white cards with a 30px number in
 * them, sitting on a white page among other white cards — nothing on the screen
 * said "look here first".
 *
 * Colour does two jobs here and they must not be confused. The **category**
 * ground says which part of the product a number belongs to. The **semantic**
 * ground says the number needs a person: `attention` with a non-zero value
 * abandons its category for coral (or amber) and a "Needs you" pill, so "needs
 * you" can never be mistaken for "fine" across a row of panels.
 *
 * A zero falls back to navy rather than wearing a bright colour, because a
 * vivid 0 reads as data when it is really the absence of it.
 */

/** Which part of the product a figure belongs to. Drives the ground colour. */
export type StatCategory = "overview" | "work" | "money" | "compliance" | "automation";

export type AttentionTone = "danger" | "warning";

export type StatTrend = {
  /** "+12%", "-4%". Shown in a pill beside the figure. */
  readonly value: string;
  /** Which way the number moved. Drives the arrow and the pill's tint. */
  readonly direction: "up" | "down";
  /** "vs last month". Optional, and quiet. */
  readonly caption?: string;
};

export type StatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  category?: StatCategory;
  /** True when a count above zero is a problem — overdue invoices, expiring certificates. */
  attention?: boolean;
  /** Which semantic tone the alarm takes. Defaults to danger. */
  attentionTone?: AttentionTone;
  icon?: LucideIcon;
  trend?: StatTrend;
  /**
   * A handful of recent values for the sparkline. Six to twelve reads best;
   * fewer than three draws nothing, because two points is a line, not a trend.
   */
  spark?: readonly number[];
};

/** Written out in full: Tailwind only ships classes it can see as literals. */
const CATEGORY_GROUND: Record<StatCategory, string> = {
  overview: "bg-kpi-navy",
  work: "bg-kpi-cobalt",
  money: "bg-kpi-teal",
  compliance: "bg-kpi-purple",
  automation: "bg-kpi-purple",
};

const ATTENTION_GROUND: Record<AttentionTone, string> = {
  danger: "bg-kpi-coral",
  warning: "bg-kpi-amber",
};

/**
 * The figure's size, chosen by how long the figure is.
 *
 * A KPI card is about 176px of usable width at four-up on a 1280px screen, and
 * at 44px the digits run about 0.53em each — so anything past seven characters
 * runs off the card and is silently clipped by its own `overflow-hidden`.
 * "£1,544.40" wants 207px of a 176px box and loses its last digits, which on a
 * money figure is not a cosmetic bug: £1,544.40 reads as £1,544.4. On this
 * platform every second figure is money, so this matters more here than it did
 * where it was written.
 *
 * Arbitrary lengths rather than a named size token, and not by accident:
 * tailwind-merge cannot tell a custom font-size utility from a text colour, so
 * a `text-kpi` token would be silently dropped whenever `text-white/60` sat
 * beside it in the same `cn()`. An arbitrary length is recognised as a size and
 * survives.
 */
function figureSize(value: string | number): string {
  const length = String(value).length;
  if (length <= 7) return "text-[2.75rem]";
  if (length <= 9) return "text-[2.25rem]";
  if (length <= 12) return "text-[1.75rem]";
  return "text-[1.5rem]";
}

/**
 * The sparkline: a polyline in a 100×32 box, stretched to the card.
 *
 * Drawn by hand rather than with a chart library because it carries no axes, no
 * labels and no interaction — everything a charting dependency exists to
 * provide. `preserveAspectRatio="none"` lets it fill whatever width the card
 * has, and `vectorEffect` keeps the stroke from stretching with it.
 */
function Spark({ points }: { points: readonly number[] }) {
  if (points.length < 3) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; this draws it down the middle instead.
  const span = max - min || 1;
  const path = points
    .map((v, i) => `${(i / (points.length - 1)) * 100},${32 - ((v - min) / span) * 28 - 2}`)
    .join(" ");

  return (
    <svg aria-hidden viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full opacity-80">
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The figure as a number, whatever it was formatted as.
 *
 * LaunchOS only ever passes counts here, so `Number(value)` was enough there.
 * On this platform half the figures are money that arrives pre-formatted —
 * "£500.00", "£1,544.40" — and `Number("£500.00")` is `NaN`. `NaN > 0` is
 * false and `NaN === 0` is false, so an overdue card sat on the navy "nothing
 * here" ground while showing £500 outstanding: the one figure that needed to
 * shout was the one that stayed quiet.
 *
 * Returns null for a figure that is genuinely not a number ("None", "—"), so a
 * caller cannot accidentally get 0 and an "all clear".
 */
function figureNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const stripped = value.replace(/[^\d.-]/g, "");
  if (stripped === "" || stripped === "-" || stripped === ".") return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

export function StatCard({
  label,
  value,
  hint,
  href,
  category = "overview",
  attention = false,
  attentionTone = "danger",
  icon: Icon,
  trend,
  spark,
}: StatCardProps) {
  const numeric = figureNumber(value);
  const isAlarming = attention && numeric !== null && numeric > 0;
  const isClear = numeric === 0;

  // A panel that needs you only says "all clear" once it is empty.
  const caption = attention && isClear ? "All clear" : hint;

  const ground = isAlarming
    ? ATTENTION_GROUND[attentionTone]
    : isClear
      ? "bg-kpi-navy"
      : CATEGORY_GROUND[category];

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          // A tile of the panel's own white at low alpha, so the icon sits in
          // the surface rather than on a second colour fighting it.
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon className="size-4" strokeWidth={1.9} />
          </span>
        ) : null}
        <p className="text-[0.9375rem] leading-tight font-semibold text-white/85">{label}</p>
      </div>

      <div className="mt-4 min-w-0">
        <p className={cn(figureSize(value), "leading-none font-bold tracking-tight tabular-nums", isClear && "text-white/60")}>
          {value}
        </p>

        {isAlarming ? (
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-[0.75rem] font-semibold tracking-[0.06em] uppercase whitespace-nowrap">
            Needs you
          </span>
        ) : null}

        {trend ? (
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold whitespace-nowrap",
              // High contrast against the panel: a trend that needs squinting
              // at is decoration.
              trend.direction === "up" ? "bg-white/20" : "bg-black/25",
            )}
          >
            {trend.direction === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.value}
            {trend.caption ? <span className="font-normal text-white/70">{trend.caption}</span> : null}
          </span>
        ) : null}
      </div>

      {/* Its own full-width row, not a column beside the figure. Beside it the
          spark was fixed at 144px against a card whose inner width is ~228px at
          four-up, and the figure drew straight through it. */}
      {spark && spark.length >= 3 ? (
        <div className="mt-4 min-w-0">
          <Spark points={spark} />
        </div>
      ) : null}

      {/* `mt-auto` pins the secondary fact to the bottom whether or not a card
          has a sparkline above it, so a row of them shares one baseline. */}
      {caption ? <p className="mt-auto pt-4 text-[0.8125rem] leading-snug text-white/70">{caption}</p> : null}
    </>
  );

  const shell = cn(
    "relative flex min-h-[156px] min-w-0 flex-col overflow-hidden rounded-[22px] p-6 text-white transition-[transform,box-shadow]",
    ground,
  );

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={cn(shell, "group hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(11,16,32,0.18)]")}>
      {body}
      <span
        aria-hidden
        className="absolute right-5 bottom-5 flex size-7 items-center justify-center rounded-full bg-white/15 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
