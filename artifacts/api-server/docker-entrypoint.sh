#!/bin/sh
set -e

echo "==> LaunchFlow API — startup"
echo "    NODE_ENV: ${NODE_ENV}"
echo "    PORT:     ${PORT:-8080}"

# ---------------------------------------------------------------------------
# Database migrations
# Run drizzle-kit push to apply any pending schema changes before boot.
# Safe to run on every startup — drizzle-kit push is idempotent.
# ---------------------------------------------------------------------------
echo "==> Running database migrations..."
/app/node_modules/.bin/drizzle-kit push --config /app/lib/db/drizzle.config.ts
echo "==> Migrations complete."

# ---------------------------------------------------------------------------
# Start the API server
# ---------------------------------------------------------------------------
echo "==> Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps /app/dist/index.mjs
