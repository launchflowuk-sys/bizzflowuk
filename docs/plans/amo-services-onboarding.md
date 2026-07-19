# Onboard AMO Services (second tenant) — construction category, bespoke design

> **Status: PLAN NOT APPROVED — mid-review.** The client said "wait" to gather the mockups/logo
> before finalizing. Treat this as still-open plan review, not an approved-and-ready-to-build
> task. Do not start writing code until the plan is explicitly approved.
>
> Preserved verbatim from session handoff (plan originally at
> `C:\Users\shoji\.claude\plans\tingly-wobbling-steele.md` on the original laptop, which is not
> accessible from this machine). Verification phrase from that handoff: `wobbling-steele-79`.

## Context

The platform's first client (owner of AMO Rendering) has a second business, AMO Services
(construction, parent company of AMO Rendering), currently at amoservices.co.uk, plus a
possible third client on the horizon. The business strategy here is a small number of
high-value tenants on this platform (not hyperscale multi-tenant SaaS) — so engineering
choices below deliberately favor matching the codebase's existing, proven patterns over
building generalized systems for hypothetical future scale.

Two things are needed: (1) construction-specific lead/quote-request fields, decided as flat
columns on `leads` (not a flexible custom-fields system — confirmed with the client, right-sized
for "two known industries, both under one owner" rather than an open-ended number of tenants),
and (2) a **genuinely distinct visual design** for AMO Services' public site, not a re-skin —
the client already has mockups and a logo prepared and wants this built using the design skills
now installed (taste-design, impeccable, ui-ux-pro-max).

## What's already true, confirmed by direct exploration (no code changes needed)

- **Domain/tenant routing is already fully multi-tenant.** `render.ts`/`public.ts` resolve
  tenant purely by `Host` header against `tenants.custom_domain` — no code hardcodes the two
  current domains. Onboarding `amoservices.co.uk` is: add the domain in Coolify's app config
  (auto-provisions the Let's Encrypt cert via Traefik, same as the existing two domains), point
  a CNAME at the server, and set `tenants.custom_domain = 'amoservices.co.uk'` on the new row.
- **`tenants.industry`** column exists (`text`, default `'rendering'`) but is currently only
  used for decorative string interpolation in `llms.txt` — it doesn't drive any branching logic
  anywhere yet. This becomes the first real use of it.
- **No existing "custom fields" precedent** anywhere in the schema — every jsonb column in use
  is a typed string array (photo URLs, etc.), not a free-form bag. Flat columns is genuinely the
  established convention, not a compromise.

## Part A — Fix hardcoded rendering-specific content site-wide (blocking, do first)

`PublicSiteApp.tsx` currently has rendering-industry prose (not just AMO Rendering's *name*,
but actual body copy — "silicone render, monocouche, K Rend, EWI, pebbledash removal" etc.)
hardcoded directly in JSX in many places, and the `STATIC_SERVICES`/`PROCESS_STEPS` fallback
arrays are AMO-Rendering-specific. Without fixing this, *any* new tenant on the existing
template would show rendering content regardless of their real data. This is foundational —
it must land before AMO Services (or any future tenant) can go live on the shared template,
and it also directly benefits every future tenant onboarded after this one.

- Audit and replace hardcoded rendering-specific strings with tenant-data-driven content
  (`tenant.name`, `settings.heroHeadline/heroSubheadline/aboutText`, real `services`/`areas`
  from the DB) — these settings fields already exist and are already configurable, they're
  just not consistently used everywhere yet.
- Fix the spots where `STATIC_SERVICES`/`PROCESS_STEPS` are used *unconditionally* instead of
  only as an empty-state fallback (found earlier this session at several call sites) — real
  tenant data should always win when it exists.

## Part B — Construction lead/quote fields (flat columns, industry-branched)

**Real business data, pulled directly from the live amoservices.co.uk site (not guessed):**
- Actual service categories (verbatim, 7 total): **New Builds, Commercial, Home Renovations,
  Loft Conversions, Electrical Services, Kitchens, Bricklaying**
- Same phone number as AMO Rendering (01375 506071) — confirmed genuinely related businesses
- Serves both residential homeowners and commercial/institutional clients (businesses, schools,
  churches, municipalities, parks) — the quote form likely needs a client-type field
  (Residential/Commercial) similar in spirit to AMO Rendering's, not identical fields
- Based in Essex; brand tone leans on integrity, transparent bids, owner attention on-site —
  relevant context for Part C's design, not just the form fields

1. **Schema**: new nullable flat columns on `leads` for construction fields. Draft set to
   review with the client (grounded in their real 7 service categories above, not a generic
   guess): `serviceInterest` reuses the existing column with these 7 real categories as options;
   new fields for project scope/size, planning permission status, has architectural drawings,
   budget range, desired start timeframe, client type (Residential/Commercial/Institutional).
   Exact final list still to be confirmed — either the client's own spec or approval of this
   draft. Migration follows the existing `ADD COLUMN IF NOT EXISTS` convention.
2. **Quote form**: `QuotePage` branches on `tenant.industry` (`'rendering'` vs `'construction'`)
   to render the right field set — reuses the existing quick-required + optional-expandable
   pattern already built, just with construction fields instead of rendering ones in the
   construction branch.
3. **Dashboard**: `LeadDetailPage`'s Contact Details block gets the same industry branch, so
   Mark's team sees construction fields for construction leads (mirrors the one existing
   `serviceInterest === "External Wall Insulation"` conditional pattern already in the file).
4. **Notifications/email**: `NotificationContext` and `buildLeadNewAdminEmail` widen with the
   new fields, following the exact same pattern used for the rendering field expansion earlier
   this session. `emailDataTable` (the underlying row renderer) is already generic — no changes
   needed there.
5. **OpenAPI spec + codegen**: add new fields to `QuoteRequestInput`/`Lead`/`LeadUpdate`, then
   `pnpm --filter @workspace/api-spec run codegen`.

## Part C — Bespoke AMO Services design (gated on assets from the client)

**Blocked on**: the mockups and logo the client has already prepared — needed before any
visual/component work starts, since pixel-level design decisions can't be planned blind.

Technical approach, confirmed via reading `entry-server.tsx`:
- `renderPublicPage` currently hardcodes `import PublicSiteApp from "./zones/public/PublicSiteApp"`
  as the only template. Add a template lookup (by tenant slug or a new `tenants.template`
  column) that selects between `PublicSiteApp` (existing) and a new second component for AMO
  Services, both rendered through the identical SSR pipeline.
- The new component is a **separate file** (new zone or new component under
  `zones/public/`), built fresh using the mockups/logo and the installed design skills — not a
  themed variant of the existing one, since the client explicitly wants it to not resemble the
  current site.
- It consumes the **same data-fetching hooks** (`useGetPublicSite`, `useListPublicServices`,
  etc.) and the **same backend** (leads, quotes, services, areas tables) as AMO Rendering —
  only the JSX/layout/CSS differs. This keeps Part A/B's backend work fully shared.
- The client-side entry point needs the identical template-selection logic so hydration
  matches what the server renders (React SSR requirement) — locate and update this alongside
  `entry-server.tsx`.
- `ROUTE_PREFETCHERS` in `entry-server.tsx` is keyed to page routes — reuse the same route
  structure (Home, Services, Areas, Quote, Contact, etc.) for the new template unless the
  mockups show a genuinely different page structure, to avoid needing a parallel prefetch table.

## Sequencing

1. Part A (site-wide content fix) — can start now, no blockers, benefits every tenant
2. Part B (construction fields) — needs either client's field spec or approval of a drafted
   default set
3. Tenant setup (create `tenants`/`tenant_settings` row for AMO Services, domain config, DNS)
   — can happen in parallel with A/B
4. Part C (bespoke design) — waiting on mockups + logo from the client

## Verification

- Part A: load amoservices.co.uk (once domain is live) and confirm zero rendering-specific
  copy appears anywhere, even before Part C's custom design lands (i.e., the *existing*
  template should render correctly and generically for AMO Services in the interim)
- Part B: submit a real construction quote request end-to-end — confirm the right fields
  show, the lead row has them populated, the dashboard and admin email both display them
  correctly, and switching back to an AMO Rendering quote still shows the original rendering
  fields untouched
- Part C: once built, verify both tenants' sites independently — confirm no visual/content
  leakage between templates, and that a config error can't accidentally serve AMO Rendering's
  design to AMO Services' domain or vice versa
- Typecheck + build all affected packages; commit, deploy, re-verify live on both domains

## Still blocked on, waiting from the client

1. The mockups and logo for AMO Services' custom design
2. Exact construction lead-field list (or approval of a draft grounded in the real 7 service
   categories above — draft not yet finalized in the plan)
