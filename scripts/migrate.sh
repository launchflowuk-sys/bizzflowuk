#!/bin/sh
# =============================================================================
# scripts/migrate.sh — Standalone database migration script
#
# Runs drizzle-kit push to apply the current schema to the target database.
# Safe to run multiple times — drizzle-kit push is idempotent.
#
# Usage (from repo root inside a running container or with local deps):
#   DATABASE_URL=postgres://... ./scripts/migrate.sh
#
# Or via docker-compose one-off:
#   docker compose run --rm api ./scripts/migrate.sh
# =============================================================================
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is required." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> LaunchFlow database migration"
echo "    Schema: $REPO_ROOT/lib/db/src/schema"

exec "$REPO_ROOT/node_modules/.bin/drizzle-kit" push \
  --config "$REPO_ROOT/lib/db/drizzle.config.ts"
