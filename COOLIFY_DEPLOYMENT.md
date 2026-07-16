# BizFlow — Coolify Deployment Guide
# Target: bizzflowuk.com · Self-hosted Coolify on Hetzner · Managed Postgres

---

## Step 1 — Add the private GitHub repo as a Source

1. Coolify sidebar → **Sources** → **Add**
2. Choose **GitHub App** or **GitHub (Deploy Key)**
   - For a private repo the easiest is **Deploy Key**:
     - Coolify generates an SSH public key — copy it
     - Go to GitHub → `launchflowuk-sys/BizzFlowuk` → **Settings → Deploy keys → Add deploy key**
     - Paste the public key, title it `Coolify`, leave **Allow write access** OFF → Save

---

## Step 2 — Create a Managed Postgres database

1. Coolify sidebar → **Databases** → **New Database** → **PostgreSQL 16**
2. Name it `bizzflow-db`
3. Click **Start** and wait until status is **Running**
4. Copy the **Internal Connection URL** — you'll use it as `DATABASE_URL` in Step 4

---

## Step 3 — Create the Docker Compose resource

1. Coolify sidebar → **Projects** → your project → **New Resource**
2. Select **Docker Compose** → choose the GitHub source from Step 1
3. Repository: `launchflowuk-sys/BizzFlowuk` · Branch: `main`
4. Compose file path: `docker-compose.yml`
5. Set the **domain** on the `web` service: `https://bizzflowuk.com`

---

## Step 4 — Set environment variables

In the resource's **Environment Variables** tab, add:

```env
DATABASE_URL=         ← paste the Internal Connection URL from Step 2
SESSION_SECRET=       ← generate below
```

Generate SESSION_SECRET (run this on any machine with Node):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Optional (only needed if using file/image uploads):
```env
DEFAULT_OBJECT_STORAGE_BUCKET_ID=
PRIVATE_OBJECT_DIR=
PUBLIC_OBJECT_SEARCH_PATHS=
```

---

## Step 5 — Point DNS to your Hetzner server

In your domain registrar (wherever bizzflowuk.com is registered):

```
A    @      →  <your Hetzner server IP>
A    www    →  <your Hetzner server IP>
```

DNS propagation takes 5–30 minutes. Coolify handles SSL (Let's Encrypt) automatically once DNS resolves.

---

## Step 6 — Deploy

Click **Deploy** in Coolify. The build order is:

1. Docker builds the `bizzflowuk-api` image (~2–3 min — Node 24 + pnpm install + esbuild)
2. Docker builds the `web` image (~2–3 min — Vite production build → nginx)
3. `bizzflowuk-api` container starts → runs DB migrations automatically → health check passes
4. `web` container starts → nginx serves the React app, proxies `/api` to `bizzflowuk-api:8080`

---

## Services summary

| Service | What it does | Port |
|---------|-------------|------|
| `bizzflowuk-api` | Express API + Drizzle ORM | 8080 (internal) |
| `web` | nginx serving React SPA | 80 → Coolify routes to your domain |

**Note:** the API service is deliberately named `bizzflowuk-api`, not the generic `api` — on Coolify's shared Docker network, a generic service name can collide with another project's service of the same name, causing requests to be intermittently routed to the wrong container. Don't rename it back to `api`.

**Database:** Coolify managed Postgres 16 (separate from compose — survives redeployments)

---

## Health checks

- **API:** `GET /api/healthz` — must pass before `web` starts
- **Web:** `GET /` (nginx root)

---

## Database migrations

Migrations run **automatically** at every API container startup via `scripts/run-migrations.mjs`.
No manual step needed on first deploy or after updates.

---

## Redeploying after code changes

Push to `main` branch on GitHub. In Coolify, either:
- Enable **Auto Deploy** (webhook) — deploys automatically on every push
- Or click **Redeploy** manually

---

## Admin logins (change passwords after first deploy)

| Email | Password | Role |
|-------|----------|------|
| shujaatchaudary@gmail.com | `BizFlow2024!` | Super Admin |
| mark@amorendering.co.uk | `BizFlow2024!` | Tenant Admin — AMO Rendering |
| shoji147@gmail.com | `BizFlow2024!` | Tenant Admin — AMO Rendering |

**⚠️ Change these passwords immediately after first login on production.**
