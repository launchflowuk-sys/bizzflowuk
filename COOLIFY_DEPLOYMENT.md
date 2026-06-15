# BizFlow / LaunchFlow — Coolify Deployment

## Deployment type

In Coolify, select:

```
Docker Compose
```

Public service: **web**, public port: **80**

## Required environment variables

Set these in Coolify's environment variable UI:

```env
POSTGRES_PASSWORD=strong_random_password
SESSION_SECRET=long_random_64_char_plus_secret
```

Generate `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Optional (object storage, only if using file uploads):

```env
DEFAULT_OBJECT_STORAGE_BUCKET_ID=
PRIVATE_OBJECT_DIR=
PUBLIC_OBJECT_SEARCH_PATHS=
WEB_PORT=80
```

## Services

| Service | Build context | Dockerfile |
|---------|--------------|------------|
| `db` | — | postgres:16-alpine (image) |
| `api` | `.` | `artifacts/api-server/Dockerfile.server` |
| `web` | `.` | `artifacts/web/Dockerfile.web` |

## Health checks

- **API**: `GET /api/healthz` — checked before web container starts
- **Web**: `GET /` (nginx)

## Database migrations

Migrations run automatically at API container startup via `scripts/run-migrations.mjs`. No manual step required.

## Important

- Do **not** deploy `artifacts/mockup-sandbox` — that is a development-only component preview server.
- The `web` nginx container proxies `/api` requests to `api:8080` internally — no separate API domain needed.
