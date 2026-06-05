# LaunchFlow — SaaS Platform for Home Improvement Businesses

A multi-tenant SaaS platform that gives home improvement businesses (rendering, roofing, landscaping, etc.) a public website, CRM dashboard, customer portal, and AI-powered tools — all white-labelled under their own brand.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, served at `/api` via shared proxy)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + wouter (routing) + Clerk (auth)

## Where things live

- `lib/db/` — Drizzle schema, migrations, seed data
- `lib/api-spec/openapi.yaml` — Source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — Generated React Query hooks (do NOT edit directly)
- `artifacts/api-server/src/routes/` — Express route handlers (14 route files)
- `artifacts/web/src/App.tsx` — Root router with zone routing
- `artifacts/web/src/zones/public/PublicSiteApp.tsx` — Tenant public website
- `artifacts/web/src/zones/dashboard/DashboardApp.tsx` — Tenant admin CRM
- `artifacts/web/src/zones/portal/PortalApp.tsx` — Customer portal
- `artifacts/web/src/zones/admin/AdminApp.tsx` — LaunchFlow super-admin

## Architecture decisions

- **Zone-based routing**: URL prefix determines which app renders (`/site/:slug`, `/dashboard`, `/portal`, `/admin`, `/` = landing)
- **Public routes need a nested wouter Router**: `<Router base={/site/${slug}>` is required inside PublicSiteApp because inner Switch routes (`/`, `/services`) are relative to the tenant base path
- **OpenAPI-first API**: All API shapes come from `lib/api-spec/openapi.yaml`; never write types manually for API payloads
- **Route mounting**: Express routes in `routes/*.ts` use paths WITHOUT `/api/` prefix (e.g. `"/public/:tenantSlug/site"`) — the `/api` prefix is added by `app.use("/api", router)` in `app.ts`
- **Auth**: Clerk handles authentication; `setAuthTokenGetter` in `lib/api-client-react` attaches Bearer tokens to all API calls

## Product

- **Public tenant website** (`/site/:tenantSlug`) — Full marketing site with services, areas, gallery, reviews, blog, case studies, FAQs, quote form, contact form, colour visualiser
- **Tenant admin CRM** (`/dashboard`) — Lead pipeline, quotes, projects, customer management, content management, settings
- **Customer portal** (`/portal`) — Customers can view their jobs, quotes, project updates
- **LaunchFlow super-admin** (`/admin`) — Manage tenants, plans, platform stats

## Seed tenant

- Slug: `amo-rendering`, industry: rendering, plan: pro
- Demo site: `/site/amo-rendering`
- 5 services, 6 areas, 6 reviews, 3 case studies, 8 FAQs, 3 blog posts, 6 gallery images, 3 before/after pairs, 6 demo leads

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Route prefix bug pattern**: If you see `404` on API calls, check whether route handlers have `/api/` in the path string — they must NOT (the prefix is added at mount time)
- **Generated API client path**: The `getPublicSite` hook hits `/api/public/:tenantSlug/site` (not `/api/public/:tenantSlug`) — always regenerate client after changing OpenAPI spec
- **Nested Router in wouter**: A zone component that handles sub-routes of a dynamic base path (e.g. `/site/:slug/*`) MUST wrap its Switch in `<Router base={basePath}>` or inner routes won't match

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
