/**
 * Fixture data for the public BizzFlowUK demo.
 *
 * Verbatim from the handoff's specification/demo-data.json, which matches
 * reference/demo.js. Oak & Stone and every person named here are fictional.
 *
 * This is display data for a marketing demo and nothing else. It never touches
 * the database, never reaches an API, and must never be mistaken for a tenant:
 * real workspaces come from the server behind authentication, and the two must
 * not meet.
 */

export type DemoView = "overview" | "customers" | "quotes" | "jobs" | "schedule" | "invoices" | "website";

export const DEMO_VIEWS: readonly DemoView[] = [
  "overview",
  "customers",
  "quotes",
  "jobs",
  "schedule",
  "invoices",
  "website",
];

/** Title and subtitle for each view. */
export const VIEW_COPY: Record<DemoView, readonly [string, string]> = {
  overview: ["Good morning, James.", "A clear view of your day, from the first job to the last invoice."],
  customers: ["Your customers. All together.", "Every enquiry, every job and every relationship in one place."],
  quotes: ["Good work starts with a clear quote.", "See what is awaiting approval and try creating a sample quote."],
  jobs: ["Keep the work moving.", "See the job, the customer and the team behind it."],
  schedule: ["A well-planned working day.", "Monday, 14 September 2026 · Sample schedule"],
  invoices: ["Stay on top of the paperwork.", "See what is paid and what needs a follow-up."],
  website: ["Your best first impression.", "A sample of the front door to your connected business."],
};

export const NAV_ITEMS: readonly { view: DemoView; icon: string; label: string }[] = [
  { view: "overview", icon: "▦", label: "Overview" },
  { view: "customers", icon: "♧", label: "Customers" },
  { view: "quotes", icon: "▤", label: "Quotes" },
  { view: "jobs", icon: "▧", label: "Jobs" },
  { view: "schedule", icon: "▣", label: "Schedule" },
  { view: "invoices", icon: "£", label: "Invoices" },
  { view: "website", icon: "↗", label: "Your website" },
];

export type DemoJob = {
  id: string; title: string; customer: string; trade: string;
  status: string; value: number; date: string; team: string; note: string;
};

export const JOBS: readonly DemoJob[] = [
  { id: "JOB-1042", title: "Oakfield garden transformation", customer: "Sarah Mitchell", trade: "Landscaping", status: "In progress", value: 4250, date: "14 September", team: "James & Alex", note: "Patio base complete. Paving and planting are next on the schedule." },
  { id: "JOB-1041", title: "Kitchen renovation", customer: "David Thompson", trade: "Construction", status: "In progress", value: 8400, date: "14 September", team: "Ben & Oliver", note: "Fit the remaining cabinets and prepare for the final finishing work." },
  { id: "JOB-1040", title: "Driveway installation", customer: "Oakfield Developments", trade: "Paving", status: "Scheduled", value: 5600, date: "16 September", team: "James & Alex", note: "Site access confirmed. Materials delivery planned for the morning." },
  { id: "JOB-1039", title: "Boiler installation", customer: "Emily Roberts", trade: "Plumbing & heating", status: "Completed", value: 2800, date: "14 September", team: "Oliver", note: "Installation completed. Customer handover recorded in this sample job." },
];

export type DemoCustomer = { name: string; work: string; stage: string; area: string; jobs: number };

export const CUSTOMERS: readonly DemoCustomer[] = [
  { name: "Sarah Mitchell", work: "Garden transformation", stage: "Active job", area: "Chelmsford", jobs: 2 },
  { name: "David Thompson", work: "Kitchen renovation", stage: "Active job", area: "Brentwood", jobs: 1 },
  { name: "Oakfield Developments", work: "Driveway installation", stage: "Scheduled", area: "Billericay", jobs: 4 },
  { name: "Emily Roberts", work: "Boiler installation", stage: "Completed", area: "Upminster", jobs: 1 },
  { name: "Thomas Wilson", work: "Garden design enquiry", stage: "New enquiry", area: "Grays", jobs: 0 },
];

export type DemoQuote = { id: string; customer: string; title: string; value: number; status: string };

export const INITIAL_QUOTES: readonly DemoQuote[] = [
  { id: "QT-2084", customer: "Thomas Wilson", title: "Garden design & landscaping", value: 6400, status: "Awaiting approval" },
  { id: "QT-2083", customer: "Sarah Mitchell", title: "Oakfield garden transformation", value: 4250, status: "Accepted" },
  { id: "QT-2082", customer: "David Thompson", title: "Kitchen renovation", value: 8400, status: "Accepted" },
];

export type DemoInvoice = { id: string; customer: string; title: string; value: number; status: string; date: string };

export const INVOICES: readonly DemoInvoice[] = [
  { id: "INV-1026", customer: "Sarah Mitchell", title: "Garden transformation · deposit", value: 1275, status: "Paid", date: "10 September" },
  { id: "INV-1025", customer: "Emily Roberts", title: "Boiler installation", value: 2800, status: "Awaiting payment", date: "21 September" },
  { id: "INV-1024", customer: "Oakfield Developments", title: "Previous site work", value: 3600, status: "Paid", date: "7 September" },
];

/** The three customers the quote builder offers. */
export const QUOTE_CUSTOMERS = ["Sarah Mitchell", "David Thompson", "Oakfield Developments"] as const;

export const SCHEDULE_MONDAY = [
  { time: "09:00", title: "Kitchen renovation", detail: "David Thompson · Ben & Oliver" },
  { time: "11:30", title: "Site survey", detail: "Oakfield Developments · James" },
  { time: "14:00", title: "Boiler installation", detail: "Emily Roberts · Oliver" },
] as const;

export const SCHEDULE_WEDNESDAY = [
  { time: "08:30", title: "Driveway installation", detail: "Oakfield Developments · James & Alex" },
] as const;

export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

/**
 * Which visual tone a status word takes.
 *
 * The regex and the ordering come straight from reference/demo.js — an unknown
 * status falls through to the plain class rather than guessing, which is the
 * safe direction.
 */
export function statusClass(s: string): string {
  if (/Awaiting|Scheduled|Draft|enquiry/i.test(s)) return "pending";
  if (s === "Completed") return "completed";
  if (s === "Sent") return "sent";
  return "";
}

/**
 * The quote total, exactly as the reference calculates it.
 *
 * Rounded to the penny at the end rather than accumulated, so the displayed
 * figure and the stored figure can never disagree. This is a demo calculator:
 * it is not tax guidance, and it is deliberately separate from the production
 * invoice arithmetic, which works in integer pence.
 */
export function quoteTotal(labour: number, materials: number, tax: number): number {
  return Math.round((labour + materials) * (1 + tax / 100) * 100) / 100;
}

/** `view` from the query string, or overview for anything unrecognised. */
export function parseView(search: string): DemoView {
  const raw = new URLSearchParams(search).get("view");
  return DEMO_VIEWS.includes(raw as DemoView) ? (raw as DemoView) : "overview";
}
