---
name: Express route mounting pattern
description: How API routes are mounted in this project — prefix comes from app.use, not route strings
---

# Express Route Mounting

Routes in `artifacts/api-server/src/routes/*.ts` use paths WITHOUT the `/api/` prefix.

Example: `router.get("/public/:tenantSlug/site", ...)` — NOT `router.get("/api/public/:tenantSlug/site", ...)`

The `/api` prefix is added once at mount time: `app.use("/api", router)` in `app.ts`.

**Why:** The double-prefix bug (`/api/api/...`) was found in this project. A `sed -i 's|"/api/|"/|g'` had to be run across all 14 route files.

**How to apply:** Whenever adding a new route handler, use paths starting with "/" not "/api/". When debugging 404s, check this first.
