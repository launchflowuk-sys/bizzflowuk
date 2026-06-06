#!/bin/sh
# Intentionally no set -e — we handle errors explicitly for better crash diagnostics

echo "==> LaunchFlow API — startup diagnostics"
echo "    NODE_ENV:           ${NODE_ENV:-NOT SET}"
echo "    PORT:               ${PORT:-8080}"
echo "    DATABASE_URL set:   $([ -n "$DATABASE_URL" ] && echo YES || echo NO - MISSING)"
echo "    drizzle-kit path:   $(which drizzle-kit 2>/dev/null || echo NOT FOUND IN PATH)"
echo "    node version:       $(node --version)"

# ---------------------------------------------------------------------------
# Database migrations
# Run drizzle-kit push; if it fails, log the error but don't abort startup.
# The server will fail naturally if the schema is missing, but this prevents
# a crash-loop that hides the real error in the logs.
# ---------------------------------------------------------------------------
echo "==> Running database migrations..."
if /app/scripts/migrate.sh; then
  echo "==> Migrations completed"
else
  MIGRATE_EXIT=$?
  echo "==> WARN: Migration exited with code $MIGRATE_EXIT — see output above"
  echo "==> Continuing startup (server will fail if schema is missing)"
fi

# ---------------------------------------------------------------------------
# Start the API server
# ---------------------------------------------------------------------------
echo "==> Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps /app/dist/index.mjs
