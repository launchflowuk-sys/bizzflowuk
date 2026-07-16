---
name: Coolify Docker Compose Deployment
description: Hard-won lessons deploying a pnpm monorepo to Coolify via Docker Compose from GitHub. Every gotcha that burned hours.
---

# Coolify + Docker Compose + pnpm monorepo — Deployment Rules

**Why:** We lost significant time fighting Coolify's layer cache, Alpine musl, missing tsconfig, port conflicts, Traefik routing, and drizzle-kit module resolution. This file documents exactly what to do next time.

## 1. Base Image — NEVER use Alpine for build stages

**Rule:** Builder stages that run Vite, Rollup, Tailwind, or lightningcss MUST use `node:24-slim` (Debian glibc), never `node:24-alpine` (musl).

**Why:** `pnpm-workspace.yaml` overrides exclude musl native binaries to keep local installs lean. Alpine needs those musl binaries. Debian slim uses glibc — the binaries already in the lockfile.

```dockerfile
FROM node:24-slim AS builder   # ✓ glibc — works
FROM node:24-alpine AS builder # ✗ musl — build fails
```

Runtime stages: nginx stays Alpine (`nginx:1.27-alpine`). Node.js runtime also uses `node:24-slim`.

## 2. Healthchecks — node, not wget/curl

**Rule:** `node:24-slim` has no `wget` or `curl`. Use Node's built-in `http` module.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/healthz',(r)=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"
```

## 3. Copy ALL tsconfig files into the build context

**Rule:** Vite 7 follows the full `extends` chain in tsconfig.json files when transforming TypeScript. Any missing tsconfig causes a fatal `parseExtends` error.

```dockerfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./          # <-- required for Vite
COPY lib/ lib/
COPY artifacts/web/ artifacts/web/
```

## 4. vite.config.ts — never throw for missing PORT/BASE_PATH

**Rule:** Build-time env vars may not be set during Docker builds. Always provide defaults.

```typescript
const rawPort = process.env.PORT ?? "3000";
const basePath = process.env.BASE_PATH ?? "/";
```

## 5. docker-compose.yml — NEVER bind to host port 80/443

**Rule:** Coolify runs Traefik on port 80 and 443. Use `expose`, not `ports`.

## 6. Traefik routing — ALWAYS add explicit labels

`SERVICE_FQDN_WEB_80:` alone is NOT reliable. Always add explicit labels:

```yaml
web:
  expose:
    - "80"
  labels:
    - traefik.enable=true
    - traefik.docker.network=coolify          # CRITICAL — see below
    - "traefik.http.routers.launchflow-web.rule=PathPrefix(`/`)"
    - "traefik.http.routers.launchflow-web.entrypoints=http"
    - "traefik.http.routers.launchflow-web.priority=1"
    - "traefik.http.routers.launchflow-web.service=launchflow-web"  # explicit link required
    - "traefik.http.services.launchflow-web.loadbalancer.server.port=80"
  networks:
    - internal
    - coolify
```

**`traefik.docker.network=coolify` is mandatory** when a container is on multiple networks. Without it, Traefik picks an arbitrary network IP — often `internal`, which it cannot reach. This causes a 404 "page not found" from Traefik even though all containers are running perfectly.

**Explicit router-to-service link** (`routers.X.service=X`) — Traefik can silently discard a router if the service link is ambiguous.

**Entrypoint name:** Coolify's Traefik uses `http` (port 80) and `https` (port 443).

## 7. drizzle-kit at runtime — eliminate it entirely

`drizzle-kit push` at container startup is unreliable because module resolution for `drizzle-orm` fails depending on where drizzle-kit is installed. Solution:

**Generate SQL migration files at Docker BUILD time, apply with drizzle-orm migrator at startup:**

```dockerfile
# In builder stage (after pnpm install):
RUN pnpm --filter @workspace/db run generate

# In runtime stage:
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations
```

Startup: `node /app/scripts/run-migrations.mjs` using `drizzle-orm/node-postgres/migrator`.

This needs `out: path.join(__dirname, "./migrations")` in drizzle.config.ts and a `generate` script in lib/db/package.json.

## 8. Migration idempotency — existing schema detection

If DB already has schema from a prior `drizzle-kit push` but no `drizzle.__drizzle_migrations` table, the migrator re-runs all SQL and fails with "already exists" errors.

Fix in `run-migrations.mjs`: check if `tenants` table exists but `drizzle.__drizzle_migrations` does not → create tracking table and stamp all journal entries as applied before running the migrator.

## 9. drizzle.config.ts — allow missing DATABASE_URL for generate

`drizzle-kit generate` needs no DB connection but config must not throw on missing URL:

```ts
dbCredentials: {
  url: process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost/placeholder",
}
```

## 10. pnpm + Docker — node-linker=hoisted

`.npmrc` must have `node-linker=hoisted`. Without it, pnpm uses absolute-path symlinks from the build machine that break inside Docker. Copy `.npmrc` alongside the other manifests in the builder stage before `pnpm install`.

## 11. Coolify config change workflow

When docker-compose.yml changes on GitHub, Coolify shows a banner: "N unapplied configuration changes detected." User must click "View changes" → apply → redeploy. Git changes are detected but NOT auto-applied — Coolify stores compose content in its own database.

## 12. Required Coolify environment variables for this app

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✓ | Internal connection URL from Coolify's managed Postgres |
| `SESSION_SECRET` | ✓ | Any long random string — signs JWTs |
| `SEED_ADMIN_PASSWORD` | first deploy only | One-time platform-admin bootstrap; safe to remove after |
| `PRIVATE_UPLOAD_DIR` | optional | Defaults to `/data/uploads` (see docker-compose.yml volume) |

## 14. Pre-deploy checklist

- [ ] Builder stage: `node:24-slim` not alpine
- [ ] Runtime Node stage: `node:24-slim` not alpine
- [ ] Healthcheck: uses `node -e ...` not `wget`/`curl`
- [ ] Web Dockerfile copies: `tsconfig.base.json tsconfig.json`
- [ ] `vite.config.ts`: PORT and BASE_PATH have `?? "default"` fallbacks
- [ ] `docker-compose.yml`: no `ports: - "80:80"` on web service
- [ ] `docker-compose.yml`: web service has explicit Traefik labels including `traefik.docker.network=coolify`
- [ ] `docker-compose.yml`: `networks.coolify.external: true`
- [ ] drizzle-kit NOT called at runtime — SQL generated at build time
- [ ] Migration runner handles existing-schema case (stamps journal before migrating)
- [ ] Coolify env vars: all required vars set
- [ ] `pnpm-lock.yaml` is up to date
