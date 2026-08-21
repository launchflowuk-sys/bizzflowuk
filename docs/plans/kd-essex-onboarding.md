# Onboard KD Essex Landscaping & Groundworks (tenant #3) — landscaping industry

> **Status: approved to build, 21 Aug 2026.** Shoji approved writing the plan and starting the
> build in the same instruction. Building on branch `feat/kd-essex-tenant`. **Not pushed** —
> a push to `main` auto-deploys to production where AMO Rendering and AMO Services are live,
> and the standing rule is local verification before anything goes live.

## Context

Third tenant on BizzFlow. A sole trader with a van, starting his own business, doing both
domestic landscaping and groundworks. Landscaping is confirmed as his main trade. Domain
`kdessexlandscapes.co.uk` is registered but was still in registrar review on 21 Aug — it is
**not** on the critical path, because every tenant is built and reviewed on the platform path
(`/site/kd-essex`) and the custom domain is attached last.

Source research: a market-research and build-plan document supplied by the client
(competitor analysis of the Thurrock map pack, the groundworks content gap, and a proposed
250-page programmatic geo matrix). That document was written **without knowledge of BizzFlow**
— it proposes choosing between Next.js and WordPress/Divi, and routes leads into Airtable.
Both are superseded by the platform. Its research is kept; its stack and CRM decisions are not.

### Decisions taken, and by whom

| Decision | Call | Who |
|---|---|---|
| Full tenant, not a website-only build | Yes — site + CRM + portal | Shoji |
| Emphasis between landscaping and groundworks | **Balanced**, revisited during the project | Shoji |
| Palette | Option 1 "Natural & Fresh" from the client's brand sheet | Shoji |
| Stack | BizzFlow (neither Next.js nor Divi) | Claude, from code |
| Lead routing | BizzFlow CRM, not Airtable | Claude, from code |
| Geo matrix scale | Build the engine now, publish gradually — not 250 pages at launch | Claude, flagged as risk |
| Positioning | Domestic-led delivery, groundworks as the credibility angle | Claude, flagged; Shoji chose balanced |

### The positioning risk, recorded

The research document recommends leading with **commercial groundworks** targeting builders and
developers (£3k–£40k, repeat B2B). The client is one man with a van, starting out. Commercial
groundworks buyers qualify on £5–10m public liability, employers' liability, CSCS/CPCS cards,
RAMS, references and programme capacity; and they pay on 30–60 day terms, which a new sole
trader cannot finance. Leading with that would generate leads he cannot service.

Shoji's call is **balanced emphasis, adjustable later**. That is respected here, and the build
makes the balance a *data* decision rather than a code decision (see "Adjustable emphasis"
below) so it can be shifted from the dashboard without a rebuild.

The strongest usable finding from the research survives either way: *nobody in that market
competes on sub-base depth, drainage compliance, or written specification depth.* One competitor
won a job purely because *"they had a deeper base than all the other companies."* A sole trader
can deliver that. It is the spine of the site's differentiation.

### Review-count reality

KD has zero reviews. The Grays map pack leaders have 289, 168 and 104. He will not win that map
pack this year. Organic on a fresh domain is a 6–12 month play. **Google Ads is the fast lane**,
and the platform already has the paid-search landing-page pattern (`/free-quote`) and conversion
firing built. The site must convert paid traffic on day one and rank later.

## What already exists (verified against the code, not assumed)

Nothing in this list needs building:

| Capability | Where |
|---|---|
| Template dispatch by `tenants.industry` | `artifacts/web/src/zones/public/TenantSiteRouter.tsx` |
| Tenant resolution by `Host` header | `routes/render.ts`, `routes/public.ts` (strips `www.` and port) |
| Before/after drag slider | `zones/public/landing/BeforeAfterGallery.tsx` + `before_after` table |
| Photo/document upload on quote forms | `MultiFileUpload` in `PublicSiteApp.tsx` — 10 files, images + PDF + doc |
| Service pages with body content, benefits, process steps, SEO fields | `services` table |
| Area pages with per-area content, hero image, SEO fields | `areas` table |
| Case studies (challenge / solution / result / location / photos) | `case_studies` table |
| Reviews, FAQs, gallery, blog | respective tables + pages |
| GA4 + Google Ads via gtag, per tenant | `zones/public/analytics.ts`, IDs in `tenant_settings` |
| Consent Mode v2, `consent default` pushed **before** the tag script loads | `analytics.ts` |
| Conversion firing on quote form, calculator and landing form | `PublicSiteApp`, `PriceCalculator`, `landing/QuoteForm` |
| `robots.txt`, `sitemap.xml`, `llms.txt` per tenant by Host | `routes/public.ts` |
| `HomeAndConstructionBusiness`, `Service`, `FAQPage`, `Review`, `AggregateRating` schema | `PublicSiteApp.tsx` |
| SSR | `artifacts/web/src/entry-server.tsx` |
| Cost calculator on a generic price-item model | `price_items` table, `PriceCalculator.tsx` |
| CRM: lead ageing, needs-calling, one-tap Call/WhatsApp, quotes, Square payments, email logging | dashboard zone |

For KD, all tracking is **configuration** — paste the GA4 ID, `AW-` ID and conversion label into
Settings. No code.

## Design direction

### The idea

Every competitor in the research looks like a trade site — stock photography, gradient buttons,
2015 template energy. They compete on review count because nothing else distinguishes them.

**This should look like a landscape design studio that also owns the digger.** Editorial
typography, full-bleed photography, generous whitespace, restraint. That separates him from ten
identical Grays competitors, justifies higher prices to homeowners, and reads as competent to the
trade side — premium looks the same in both markets.

The supplied logo already supports this: geometric sans, wide tracking, black-and-green split,
with "LANDSCAPING & GROUNDWORKS" given equal billing. The brand itself made the balance decision.

### The signature element

Make **"what's underneath" literally visible**: a cross-section graphic of a correct patio or
driveway build — sub-base depth, membrane, bedding layer, finish — labelled with his actual
published depths.

Nothing in that market has an equivalent. It is the research's differentiator rendered as
something a homeowner can see while holding three quotes. It is worth more to conversion than
forty town pages.

### Palette — Option 1 "Natural & Fresh", contrast-corrected

Ratios below are computed (WCAG 2.1 relative luminance), not estimated.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `KD_GREEN` | `#6B8E4E` | logo green — large headlines, icons, decorative, accents on dark | 3.75:1 on white — large text and UI only |
| `KD_GREEN_DEEP` | `#5D7B45` | buttons, links, small accent text on white | **4.79:1 — AA body** |
| `INK` | `#1E1F1D` | dark panels, footer | 16.55:1 with white |
| `GREY` | `#6B6F72` | muted body text | 5.07:1 on white |
| `OFF_WHITE` | `#F5F7F4` | page background | 15.36:1 on ink |
| `PALE` | `#E2EAD9` | section tints | 13.40:1 on ink |

**The logo green fails 4.5:1 for body text** (3.75:1 on white, 4.42:1 on ink). `KD_GREEN_DEEP` is
a barely-perceptible darkening that clears AA — the same correction AMO Rendering's blue needed
(`#1F8CFF` → `#1973D1`). Brand integrity intact.

Rule: never set body copy in green on ink — use `OFF_WHITE` or `PALE`.

### Differentiation from AMO Services

AMO Services is also green (`#7DB93F` on `#161B12`). Separation comes from a deeper, less
yellow green, editorial rather than blocky typography, full-bleed photography rather than card
grids, and the cross-section device. Hue does less differentiating work than layout and type.

## Adjustable emphasis

`services` already carries `featured` and `sortOrder`. The homepage service split, nav order and
quote-form defaults are driven off that data — **not hardcoded**. Shifting balanced →
landscaping-led → groundworks-led is then a dashboard change, not a rebuild. This is the whole
reason to design it in now rather than retrofit it.

## Scope

### New code

1. **`LandscapingSiteApp.tsx`** — the template. Registered in `TenantSiteRouter` for
   `industry === "landscaping"`. Purely additive: cannot affect the two live tenants.
2. **Landscaping/groundworks lead fields** — nullable columns on `leads`, a branch in the shared
   quote form, and a display block on the dashboard lead detail page. Follows the existing
   construction-fields precedent exactly.
3. **Two-step quote form** — step 1 job type + postcode, step 2 name, phone, photos.
4. **`BreadcrumbList` + `ImageObject` schema** — the only two from the research's SEO checklist
   that are missing.
5. **Image pipeline** — see below.

### Image pipeline (not optional)

There is currently no resize, WebP conversion, `srcset` or lazy-loading on uploads, and objects
are served with `Cache-Control: public, max-age=3600`. Landscaping is the most photo-heavy
vertical on the platform and the client will upload multi-megabyte phone photos of gardens. That
will wreck mobile LCP, and no amount of SEO compensates.

Fix: derivative generation on upload (a small set of widths, WebP), `srcset`/`sizes` at the
component level, `loading="lazy"` below the fold, and long-lived immutable cache headers on
UUID-named objects. **Benefits AMO Rendering and AMO Services too.**

Risk note: this touches shared code paths used by live tenants. Build and verify locally; do not
deploy unattended.

### Geo matrix — engine now, publication later

The research proposes 250 `/{service}/{town}/` pages. **Do not publish at that scale from a
standing start.** A brand-new domain with zero reviews publishing 250 near-templated town pages
is the pattern spam systems are tuned for, and the research's own anti-thin rule ("real project
photo from that town — never stock repeated") cannot be met for towns he has never worked in.
250 × 700 words is 175,000 words of genuinely local content; content is the bottleneck, not code.

Plan: build the matrix engine early because it is reusable for every future trade tenant; publish
20–25 excellent pages first; expand once there are real reviews and photographed projects.

### Deferred, deliberately

**Extracting the shared kit out of `PublicSiteApp.tsx`.** That file is 3,568 lines and doubles as
both AMO Rendering's website and the shared component library (`PageSEO`, `JsonLd`,
`CookieBanner`, `QuoteFormSection`, `SiteBaseCtx`, `MultiFileUpload`). A third template deepens
the tangle and it should be extracted — but it is the one change in this plan that can break two
live businesses, and it should not be done unattended. Do it with Shoji available to verify.

`LandscapingSiteApp` will import from `PublicSiteApp` the same way `ConstructionSiteApp` does, so
the extraction remains a clean, separate refactor afterwards.

### Configuration only

GA4 ID, Google Ads conversion ID and label, consent, sitemap, robots, `llms.txt`, custom domain,
quote reference prefix (`KD-`), SMTP, Twilio, Square.

## Build order

| # | Step | Risk | Blocked on client? |
|---|---|---|---|
| 1 | `industry = 'landscaping'` route + `LandscapingSiteApp` template | none — additive | no |
| 2 | Lead fields migration + form branch + dashboard block | low — nullable columns | no |
| 3 | Seed the KD tenant with placeholder content | none | content only |
| 4 | Two-step quote form | low | no |
| 5 | `BreadcrumbList` + `ImageObject` schema | low | no |
| 6 | Image pipeline | medium — shared code | no |
| 7 | Matrix engine | medium | content |
| 8 | Shared-kit extraction from `PublicSiteApp` | **high — do attended** | no |
| 9 | Custom domain, GBP, tracking IDs, ads | none | yes |

## Outstanding client facts (content is the long pole)

Still unanswered, and all of them block launch rather than build:

1. **Real trading address and phone** — for NAP, schema and GBP. Working from home is fine; it
   becomes a service-area business with the address hidden. It cannot be invented.
2. **Registered company name and number** — Companies House had **no exact match** for
   "K&D Essex Landscapes" on 21 Aug. Needed for the footer and schema.
3. **The actual service list** he will quote for on day one.
4. **Photographs.** The design is photography-led. If he is starting out and has few, that is a
   real constraint to design around now, not discover at build time.
5. **Clean logo files** — the supplied image is blurred with a glow effect. Need SVG or high-res
   transparent PNG, a dark-background variant, and a square lockup for favicon and GBP.

## Commercial note

The research proposes £79 / £249 / £599 per month. That is website-maintenance pricing. This
client receives a website, a CRM, a customer portal, quoting and card payments. It should be
priced as a business system.

## Unfair advantage worth building next

BizzFlow knows which leads became **won jobs, and for how much**. Feeding that back to Google Ads
as offline conversion import makes bidding optimise for revenue rather than form fills — two £250
fencing enquiries and one £14k garden rebuild stop looking identical to the algorithm. Every
competitor in the research is optimising on form fills at best. It is only possible because Shoji
owns the platform, and it is reusable for every tenant. Not in this build; worth its own plan.
