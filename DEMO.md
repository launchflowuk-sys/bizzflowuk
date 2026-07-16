# LaunchFlow — Demo Guide

LaunchFlow is a multi-tenant SaaS platform that gives home improvement businesses a professional public website, a full CRM dashboard, and a customer portal — all white-labelled under their own brand.

The seed tenant is **AMO Rendering** (Grays, Thurrock — serving London & Essex).

---

## Quick Links

| Zone | URL | Description |
|------|-----|-------------|
| Landing page | `/` | LaunchFlow marketing site |
| AMO Rendering website | `/site/amo-rendering` | Tenant public website |
| AMO Services | `/site/amo-rendering/services` | Services listing |
| AMO Areas | `/site/amo-rendering/areas` | Areas served |
| AMO Gallery | `/site/amo-rendering/gallery` | Photo gallery |
| AMO Reviews | `/site/amo-rendering/reviews` | Customer reviews |
| AMO Blog | `/site/amo-rendering/blog` | Blog posts |
| AMO Case Studies | `/site/amo-rendering/work` | Case studies |
| Quote Form | `/site/amo-rendering/quote` | Get a free quote |
| Contact Form | `/site/amo-rendering/contact` | Contact form |
| Colour Visualiser | `/site/amo-rendering/visualiser` | Render colour tool |
| CRM Dashboard | `/dashboard` | Tenant admin panel (requires login) |
| Customer Portal | `/portal` | Customer self-service (requires login) |
| Super Admin | `/admin` | LaunchFlow platform admin (requires login) |

---

## Seed Data (AMO Rendering)

- **Tenant slug:** `amo-rendering`
- **Industry:** Rendering
- **Plan:** Pro
- **Admin email:** mark@amorendering.co.uk
- **Phone:** 01375 123456
- **Location:** Grays, Thurrock, Essex

### Pre-loaded content:
- **5 services:** Silicone Render, Monocouche Render, K-Rend, Pebble Dash Removal, EWI Systems
- **8 areas:** Grays, Thurrock, Basildon, Brentwood, Chelmsford, Romford, East London, South Essex
- **6 customer reviews** (5-star average)
- **3 case studies** with before/after details
- **3 blog posts**
- **8 gallery images** + 3 before/after pairs
- **8 FAQs**
- **6 demo leads** across different pipeline stages

---

## CRM Dashboard Features

The dashboard is at `/dashboard` and requires a Clerk account with `TENANT_ADMIN` or `STAFF` role.

### Leads Pipeline
- `/dashboard/leads` — Full lead list with status filter tabs
- `/dashboard/leads/:id` — Lead detail with:
  - Contact info, source, budget
  - Notes thread (add notes)
  - Status progression (New → Contacted → Survey Booked → Quote Sent → Won/Lost)
  - **Convert to Quote** button (creates a quote and navigates to it)
  - **Convert to Project** button (creates project directly)

### Quotes (Quote Builder)
- `/dashboard/quotes` — Quote list
- `/dashboard/quotes/:id` — Quote builder with:
  - Line items (add/delete with auto-totalling)
  - VAT calculation
  - Status workflow (Draft → Sent → Accepted → Rejected)
  - **Convert to Project** button (when Accepted)

### Projects
- `/dashboard/projects` — Project list with status filter
- `/dashboard/projects/:id` — Project detail with:
  - Address, schedule, warranty info
  - Status pipeline (Enquiry → Scheduled → In Progress → Completed)
  - Timeline updates with customer-visibility toggle

### Customers
- `/dashboard/customers` — Customer list
- `/dashboard/customers/:id` — Customer profile with linked leads, quotes, projects

### Content Management
All tenant website content is manageable from the dashboard:
- Gallery images, reviews, case studies, services, areas, FAQs, blog posts

### Messages & Visualiser
- `/dashboard/messages` — Contact form submissions
- `/dashboard/visualiser` — Colour visualiser requests

### Settings
- `/dashboard/settings` — Branding, hero copy, contact info, admin notification email, SEO

---

## Email Notifications

Emails are sent automatically when:
- A quote request is submitted via the public website
- A contact form message is sent
- A colour visualiser request is submitted

**Dev mode:** Emails are logged to the API server console (no real sending). To enable real sending, set:
```
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<your Resend API key>
EMAIL_FROM=noreply@yourdomain.com
```

---

## RBAC (Role-Based Access)

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | All tenants, all data, `/admin` panel |
| `TENANT_ADMIN` | Own tenant only, full dashboard access |
| `STAFF` | Own tenant only, read/write CRM data |
| `CUSTOMER` | Portal only (`/portal`), own jobs/quotes |

Tenant isolation is enforced at the API level — all queries filter by `tenantId` from the authenticated user's session. SUPER_ADMIN bypasses the tenant filter and can see all data.

---

## Image Uploads

File uploads use local-disk storage on the API container (mounted as a Docker volume):
- Request an upload target: `POST /api/storage/uploads/request-url`
- Upload directly to the returned same-origin URL from the browser
- Store the returned object path in the relevant record

---

## Architecture

```
Browser → Shared Proxy (port 80)
  ├── /          → web (React + Vite, port varies)
  ├── /site/*    → web (PublicSiteApp zone)
  ├── /dashboard → web (DashboardApp zone)
  ├── /portal    → web (PortalApp zone)
  ├── /admin     → web (AdminApp zone)
  └── /api/*     → api-server (Express 5, port 8080)
```

**Stack:**
- Frontend: React 19 + Vite + Tailwind CSS + wouter
- API: Express 5 + Pino logging
- Database: PostgreSQL + Drizzle ORM
- Auth: custom JWT (Bearer token, multi-tenant, role-based)
- API contracts: OpenAPI → Orval → React Query hooks (type-safe)
- Storage: local-disk object store on the API container (Docker volume)

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |
| `PRIVATE_UPLOAD_DIR` | Local-disk upload storage path |

Optional (email):
| `EMAIL_PROVIDER` | `resend` (default: dev/log-only mode) |
| `EMAIL_API_KEY` | Resend API key |
| `EMAIL_FROM` | From address |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Push DB schema
pnpm --filter @workspace/db run push

# Regenerate API client (after OpenAPI spec changes)
pnpm --filter @workspace/api-spec run codegen

# Start API server
pnpm --filter @workspace/api-server run dev

# Start web app
pnpm --filter @workspace/web run dev

# Full typecheck
pnpm run typecheck
```
