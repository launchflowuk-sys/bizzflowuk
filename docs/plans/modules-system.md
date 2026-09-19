# Plan — Modules: each business sees only what it uses

Status: **draft for Shoji's sign-off** · 17 Sep 2026

## Why

BizzFlow shows every tenant every screen: a window company sees Certificates,
a cleaning company opens a lead full of rendering questions, and Thurrock
Training would see "Book survey". Each new niche makes this worse. Before any
training features are built, the dashboard has to be able to switch whole areas
on and off per business.

## The idea in one paragraph

A **module** is a named area of the product (Quotes, Certificates, Website,
Courses…). Each **business type** comes with a default set. Any single tenant
can be adjusted in /admin (for example, Splendid keeps its own WordPress site,
so its Website group is off). The dashboard menu, home cards, pages, Flo and the
API all read the same resolved list. A switched-off module is hidden **and**
refused by the API, not just hidden.

## Rules (carried from what has already burned us)

1. A module is **data**. No `if (tenant.slug === …)` and no `if (industry === …)`
   in screens. Screens only ask `hasModule("certificates")`.
2. **One source of truth**: `artifacts/api-server/src/lib/modules.ts`. The web
   app receives the resolved list from the API; it never keeps its own copy.
3. **Core is never switchable** (Dashboard, Flo, Leads, Customers, Emails, Team,
   Settings, Help, Billing). A business without leads isn't a BizzFlow business.
4. **Existing tenants lose nothing they use.** Their defaults are checked
   against what they actually have data in before release (step 6).
5. Hidden ≠ deleted. Switching a module off hides it; the data stays, and
   switching it back on restores everything.

## Modules (from today's menu)

| Key | Screens | Core? |
|---|---|---|
| `core` | Dashboard, Flo, Leads, Customers, Emails, Team, Help, Settings, Billing | always on |
| `quotes` | Quotes, quote → job conversion | |
| `payments` | Payment links | |
| `surveys` | "Book survey" card on a lead | |
| `jobs` | Jobs, per-job QR share | |
| `schedule` | Schedule / diary, calendar feed | |
| `properties` | Properties (landlord portfolios) | |
| `certificates` | Certificates, renewals | |
| `files` | Files | |
| `invoices` | Invoices | |
| `expenses` | Expenses | |
| `cashflow` | Cash flow, VAT position | |
| `website` | Your website, Services, Pricing, Areas, Gallery, Case studies, Reviews, FAQs, Blog | |
| `calculator` | Pricing items + website cost calculator, estimate on leads | |
| `automations` | Automations | |
| `bookingqr` | QR code | |
| `visualiser` | Visualiser | |
| `teamchat` | Messages | |
| `courses` | *(future)* Courses, sessions, bookings, learners | |

## Default modules per business type — **please confirm**

✓ = on by default. Anything can be changed per tenant afterwards.

| Module | Plumbing | Construction | Landscaping | Rendering | Cleaning | Training | Windows | Roofing | Electrical | General |
|---|---|---|---|---|---|---|---|---|---|---|
| quotes | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| surveys | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| jobs | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| schedule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| properties | ✓ | | | | ✓ | | | | ✓ | |
| certificates | ✓ | | | | | ✓ | | | ✓ | |
| files | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| invoices | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| expenses | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cashflow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| website | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| calculator | | ✓ | ✓ | ✓ | | | | | | |
| automations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| bookingqr | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| visualiser | | | ✓ | ✓ | | | | | | |
| teamchat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| courses | | | | | | ✓ | | | | |

Notes: Training's Certificates means learner certificates (the renewal engine is
reused); the training-specific certificate type comes with the Courses module.
Properties for Cleaning = the client sites they clean.

## Planned per-tenant changes after release

| Tenant | Type | Changes from defaults |
|---|---|---|
| AMO Rendering | rendering | none |
| AMO Services | construction | none |
| KD Essex | landscaping | none |
| BPS Plumbing | plumbing | none |
| AMA Facilities | **cleaning** (switch from general) | `website` off — keeps its WordPress site |
| Splendid | windows | `website`, `calculator`, `visualiser` off — WordPress site |
| Thurrock Training | training | `website` stays on (their new site is built on BizzFlow) |
| Demo (LF Builders) | landscaping | none |

## Build steps

**1. Registry and resolver** — `api-server/src/lib/modules.ts`
- `MODULES` (key, label, core flag), `DEFAULT_MODULES` per business type, kept
  beside `INDUSTRIES` (move `INDUSTRIES` out of `routes/signup.ts` into
  `lib/industries.ts`).
- `resolveModules(industry, overrides)`: defaults, then the tenant's `features`
  overrides; unknown keys ignored; core always on.
- Unit tests: defaults for every type, overrides both ways, a bad override key,
  core can't be switched off, unknown business type falls back to `general`.

**2. API surface**
- `/auth/me` → each business in `businesses[]` gains `modules: string[]`.
- `GET /tenants/:id/modules` and `PATCH /tenants/:id/modules` (SUPER_ADMIN):
  body `{ overrides: Record<moduleKey, boolean> }`, validated against `MODULES`;
  stored in the existing `tenants.features` column.
- `GET /modules/catalog` (SUPER_ADMIN): modules + defaults, for the admin panel.
- The `features` column is used by the code but was never added by a migration
  (prod was initialised with `drizzle-kit push`). Add
  `0058_tenant_features.sql` with `ADD COLUMN IF NOT EXISTS` so a fresh database
  matches.

**3. API enforcement**
- `requireModule(key)` middleware: resolves the caller's active tenant and
  returns **404** when the module is off (same terse answer as a missing route).
  Resolution cached per request.
- Mounted on each module's own routers only (quotes, paymentLinks, projects/jobs,
  schedule, properties, certificates*, files, invoices, expenses, money, content
  and blog for the website, visualiser, teamMessages, automations).
- Cross-module reads stay open where one module legitimately shows another's data
  (a customer's history listing invoices, say). The rule is "can't *open*
  the module", not "data disappears everywhere".
- Public routes (the public site, pay pages, job share pages) are untouched: a
  payment link that was sent to a customer must keep working.

**4. Dashboard**
- `useModules()` from the active business in `/me`.
- The menu filters each group; an empty group disappears.
- A route whose module is off shows a small "This isn't switched on for your
  business" page instead of a broken screen.
- Home: KPI cards and the "Needs you today" panel skip modules that are off
  (no "Pipeline value" without quotes).
- Lead page: the Survey card needs `surveys`, the calculator estimate needs
  `calculator`, and "Convert to quote" needs `quotes`.
- Business switcher: switching business re-reads the list (it comes with the
  business, so this is free).

**5. Flo**
- Flo's data snapshot only includes enabled modules. That snapshot is what
  limits what Flo can see and say, so it must not describe screens the business
  can't open.

**6. Admin**
- Tenant detail → **Modules** panel: grouped toggles; each shows *default* or
  *changed*; a "Reset to defaults" button; core shown locked.
- Changing the business type shows which defaults will change before saving.
- Before release: a read-only count per tenant of rows in each module's tables,
  so no tenant has a module switched off that it actually has data in.

**7. Tests**
- The resolver's unit tests (step 1).
- New e2e `scripts/e2e/modules.mjs`: turn `certificates` off for a test tenant,
  then check the API returns 404, the menu omits it, and turning it back on
  restores it; also that core can't be switched off, a non-admin can't PATCH,
  and another tenant is unaffected.
- The existing suite (134/134 baseline) stays green.

**8. Release and tenant setup**
- Push, confirm the deploy built, check each live tenant's menu against the
  table above, then apply the per-tenant changes and switch AMA to Cleaning.

## Not in this plan (next plans)

- **Courses module** for Thurrock: courses, sessions (dates, venue, seats,
  price), bookings with Stripe deposit, attendee lists, pre-course emails, exam
  result per learner, certificate expiry → renewals.
- **Training public site template**, built from the design brief
  (`docs/briefs/thurrock-training-design-brief.md`).
- Words that change by trade ("Jobs" vs "Bookings", "Survey" vs "Site visit").

## Risks

- Hiding a screen a tenant relies on: mitigated by the data check in step 6
  and by overrides.
- Missing an API router: the e2e covers each module key, not only one.
- The `/me` payload grows: a list of short strings, negligible.

## Decisions needed from Shoji

1. The default table above: anything to change?
2. The core list: is anything there that shouldn't be locked on, or missing?
3. Website group off for Splendid and AMA (both keep WordPress): agreed?
