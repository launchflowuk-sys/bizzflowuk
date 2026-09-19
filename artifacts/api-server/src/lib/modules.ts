/**
 * Modules: each business sees only what it uses.
 *
 * A module is a named area of the product (Quotes, Certificates, Website...).
 * A business type comes with a default set; any tenant can override individual
 * keys afterwards (stored in `tenants.features`). The dashboard menu, the API's
 * `requireModule` gate and Flo's data snapshot all read this same resolved
 * list — see docs/plans/modules-system.md (approved 19 Sep 2026) for the design.
 *
 * Rule: a module is data. No `if (tenant.slug === ...)` and no
 * `if (industry === ...)` anywhere else — screens and routes only ask
 * `hasModule(resolved, "certificates")`.
 */

export interface ModuleDef {
  key: string;
  label: string;
  /** Core modules are always on and never appear in a tenant's overrides. */
  core?: boolean;
}

export const MODULES: ModuleDef[] = [
  { key: "core", label: "Dashboard, Leads, Customers, Emails, Team, Settings", core: true },
  { key: "quotes", label: "Quotes" },
  { key: "payments", label: "Payment links" },
  { key: "surveys", label: "Book survey" },
  { key: "jobs", label: "Jobs" },
  { key: "schedule", label: "Schedule / diary" },
  { key: "properties", label: "Properties" },
  { key: "certificates", label: "Certificates" },
  { key: "files", label: "Files" },
  { key: "invoices", label: "Invoices" },
  { key: "expenses", label: "Expenses" },
  { key: "cashflow", label: "Cash flow" },
  { key: "website", label: "Your website" },
  { key: "calculator", label: "Pricing calculator" },
  { key: "automations", label: "Automations" },
  { key: "bookingqr", label: "QR code" },
  { key: "visualiser", label: "Visualiser" },
  { key: "teamchat", label: "Messages" },
  { key: "courses", label: "Courses (future)" },
];

export const CORE_MODULES = MODULES.filter(m => m.core).map(m => m.key);
const MODULE_KEYS = new Set(MODULES.map(m => m.key));

/**
 * Default modules per business type. Keys match `industry` in the tenants
 * table (see INDUSTRIES in routes/signup.ts) plus "general" as the fallback
 * for anything unrecognised. Table approved by Shoji 19 Sep 2026.
 */
export const DEFAULT_MODULES: Record<string, string[]> = {
  plumbing: ["quotes", "payments", "surveys", "jobs", "schedule", "properties", "certificates", "files", "invoices", "expenses", "cashflow", "website", "automations", "bookingqr", "teamchat"],
  construction: ["quotes", "payments", "surveys", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "calculator", "automations", "bookingqr", "teamchat"],
  landscaping: ["quotes", "payments", "surveys", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "calculator", "automations", "bookingqr", "visualiser", "teamchat"],
  rendering: ["quotes", "payments", "surveys", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "calculator", "automations", "bookingqr", "visualiser", "teamchat"],
  cleaning: ["quotes", "payments", "surveys", "jobs", "schedule", "properties", "files", "invoices", "expenses", "cashflow", "website", "automations", "bookingqr", "teamchat"],
  training: ["payments", "schedule", "certificates", "files", "invoices", "expenses", "cashflow", "website", "automations", "teamchat", "courses"],
  windows: ["quotes", "payments", "surveys", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "automations", "bookingqr", "teamchat"],
  roofing: ["quotes", "payments", "surveys", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "automations", "bookingqr", "teamchat"],
  electrical: ["quotes", "payments", "surveys", "jobs", "schedule", "properties", "certificates", "files", "invoices", "expenses", "cashflow", "website", "automations", "bookingqr", "teamchat"],
  general: ["quotes", "payments", "jobs", "schedule", "files", "invoices", "expenses", "cashflow", "website", "automations", "teamchat"],
};

/**
 * The active module list for a tenant: its business type's defaults, with the
 * tenant's own overrides applied, core forced on, and unknown keys dropped.
 *
 * @param industry Tenant's business type; falls back to "general" defaults
 *   when unrecognised (a new type added to signup before its module row here).
 * @param overrides `tenants.features` — `{ moduleKey: boolean }`. A `false`
 *   for a core key is ignored: core can't be switched off.
 */
export function resolveModules(industry: string | null | undefined, overrides: Record<string, boolean> | null | undefined): string[] {
  const defaults = DEFAULT_MODULES[industry ?? ""] ?? DEFAULT_MODULES.general;
  const active = new Set(defaults);

  for (const [key, on] of Object.entries(overrides ?? {})) {
    if (!MODULE_KEYS.has(key) || CORE_MODULES.includes(key)) continue;
    if (on) active.add(key); else active.delete(key);
  }
  for (const key of CORE_MODULES) active.add(key);

  return [...active];
}

export function hasModule(resolved: string[], key: string): boolean {
  return resolved.includes(key);
}

/* ── Self-check: run with `node --experimental-strip-types src/lib/modules.ts` */
import { fileURLToPath } from "node:url";
import path from "node:path";
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error("FAILED: " + msg); };

  for (const type of Object.keys(DEFAULT_MODULES)) {
    const resolved = resolveModules(type, null);
    assert(CORE_MODULES.every(c => resolved.includes(c)), `${type}: core module missing`);
  }
  const overridden = resolveModules("plumbing", { website: false, calculator: true, notarealmodule: true });
  assert(!overridden.includes("website"), "override false should remove a module");
  assert(overridden.includes("calculator"), "override true should add a module");
  assert(!overridden.includes("notarealmodule"), "unknown override key must be ignored");
  const coreLocked = resolveModules("plumbing", { core: false, quotes: false });
  assert(coreLocked.includes("core"), "core must not be switchable off");
  assert(!coreLocked.includes("quotes"), "a real module should still switch off");
  assert(resolveModules("not-a-real-industry", null).length === resolveModules("general", null).length, "unknown industry should fall back to general");

  console.log("modules.ts self-check: OK");
}
