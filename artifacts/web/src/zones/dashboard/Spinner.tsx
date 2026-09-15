/**
 * The little spinner that goes inside a button while it is working.
 *
 * Exists because "the button changes its words" turned out not to be enough
 * feedback. On a phone, on 5G, a press that swaps "Connect" for "Opening…"
 * and then redraws the panel a moment later reads as a flicker rather than as
 * progress — you are left wondering whether you actually hit it.
 *
 * `currentColor` so it inherits whatever the button is: white on a brand
 * button, slate on a bordered one, without a variant for each.
 */
export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
