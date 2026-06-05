# Deploying LaunchFlow to Coolify

Self-hosted deployment: GitHub → Coolify → your server.  
One `git push` to `main` triggers a full build and zero-downtime redeploy.

---

## Prerequisites

- A Coolify instance running on your server ([coolify.io](https://coolify.io))
- A GitHub account with a repository for this project
- Your domain pointed at your server's IP (e.g. `bizflow.yourcompany.com`)
- Clerk production keys from the Replit Auth pane

---

## Step 1 — Push to GitHub

In the Replit shell (or your local terminal):

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## Step 2 — PostgreSQL database in Coolify

1. In Coolify, go to **Databases → New Database → PostgreSQL**
2. Name it `launchflow-db`, choose version **16**
3. Set a strong password — copy it, you'll need it for `DATABASE_URL`
4. Click **Start**
5. Copy the **Internal Connection URL** — it will look like:
   ```
   postgres://postgres:PASSWORD@launchflow-db:5432/postgres
   ```

---

## Step 3 — API Server service

1. **New Resource → Application → GitHub**
2. Select your repository and branch `main`
3. Set **Dockerfile path**: `artifacts/api-server/Dockerfile`
4. Set **Build context**: `/` (repo root)
5. Set **Port**: `8080`
6. Under **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DATABASE_URL` | *(from Step 2 — use internal URL)* |
| `CLERK_SECRET_KEY` | *(from Replit Auth pane — sk_live_...)* |
| `SESSION_SECRET` | *(generate: `openssl rand -hex 64`)* |

7. Under **Domains**, add: `api.bizflow.yourcompany.com` (or any subdomain you prefer)
8. Enable **Auto Deploy on Push**
9. Click **Deploy**

---

## Step 4 — Web Frontend service

1. **New Resource → Application → GitHub**
2. Same repository and branch `main`
3. Set **Dockerfile path**: `artifacts/web/Dockerfile`
4. Set **Build context**: `/` (repo root)
5. Set **Port**: `80`
6. Under **Build Arguments** (important — these are baked into the JS bundle):

| Key | Value |
|-----|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | *(from Replit Auth pane — pk_live_...)* |
| `VITE_CLERK_PROXY_URL` | `https://api.bizflow.yourcompany.com/clerk-proxy` |
| `BASE_PATH` | `/` |
| `PORT` | `3000` |

7. Under **Domains**, add: `bizflow.yourcompany.com` (your root domain)
8. Enable **Auto Deploy on Push**
9. Click **Deploy**

> **Note**: `VITE_*` variables are build-time only — they get baked into the
> JavaScript bundle by Vite. If you change them you must trigger a rebuild.

---

## Step 5 — Verify the deployment

```bash
# API health check
curl https://api.bizflow.yourcompany.com/api/healthz
# Expected: {"status":"ok"}

# Frontend
open https://bizflow.yourcompany.com
```

The API server logs will show the migration run on first boot:
```
==> Running database migrations...
==> Migrations complete.
==> Starting API server on port 8080...
```

---

## Step 6 — Set your super admin account

After signing up at `https://bizflow.yourcompany.com/sign-up`:

```sql
-- Connect to your Coolify PostgreSQL instance and run:
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your@businessemail.com';
```

In Coolify, open the PostgreSQL service → **Terminal** → run the query above.

Sign out and back in — you'll land on `/admin` automatically.

---

## Auto-deploy flow (ongoing)

```
git add .
git commit -m "feat: ..."
git push origin main
        ↓
GitHub webhook notifies Coolify
        ↓
Coolify pulls latest, docker build runs
        ↓
New containers start, migrations run, old containers stop
        ↓
Live ✅
```

---

## Custom domains for clients

When a client wants their website on `www.theircompany.co.uk`:

1. Ask the client to add a DNS record at their registrar:
   ```
   Type:  CNAME
   Name:  www
   Value: bizflow.yourcompany.com
   ```
2. In Coolify on the **Web** service, add `www.theircompany.co.uk` as an additional domain
3. Coolify will provision an SSL certificate automatically via Let's Encrypt
4. In the LaunchFlow admin panel (`/admin`), set that domain on the tenant record

> See the **Custom Domains & Tenant Onboarding** task for the admin UI that
> manages this — it will let you set domains without touching Coolify manually.

---

## Architecture notes for self-hosting

| Service | Internal hostname | External URL |
|---------|------------------|--------------|
| PostgreSQL | `launchflow-db` | Internal only |
| API server | `launchflow-api` | `api.bizflow.yourcompany.com` |
| Web frontend | `launchflow-web` | `bizflow.yourcompany.com` |

- The nginx container proxies `/api/` to the API service — no CORS issues
- All Clerk authentication happens through `/clerk-proxy` on your own domain
- Database is never exposed externally — only the API container can reach it

---

## ARM64 servers (AWS Graviton, Hetzner ARM)

The `pnpm-workspace.yaml` currently excludes all non-linux-x64 esbuild binaries
to keep the Replit environment lean. If your Coolify server is ARM64, add these
two overrides to `pnpm-workspace.yaml` before pushing:

```yaml
# Remove or comment out these two lines:
"esbuild>@esbuild/linux-arm": "-"
"esbuild>@esbuild/linux-arm64": "-"
```

---

## Troubleshooting

**Build fails: `PORT environment variable is required`**  
→ The web Dockerfile sets `PORT=3000` as a build arg. If it's missing, check
that Coolify is passing build args from Step 4.

**API returns 500 on startup**  
→ Check the API service logs in Coolify. Most likely `DATABASE_URL` is wrong
or the database hasn't started yet. Verify the internal connection URL.

**Clerk sign-in loop / "Missing publishable key"**  
→ `VITE_CLERK_PUBLISHABLE_KEY` was not set at build time. Re-deploy the web
service with the correct build argument and trigger a fresh build.

**Migrations fail on first boot**  
→ The database may not be ready yet. Coolify's health check dependency should
prevent this, but you can re-deploy the API service to trigger another migration run.
