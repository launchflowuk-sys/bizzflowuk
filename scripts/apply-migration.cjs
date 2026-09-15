/**
 * Apply one migration file locally.
 *
 *   node scripts/apply-migration.cjs 0040_subscriptions
 *
 * Runs from anywhere in the repo.
 *
 * `scripts/run-migrations.mjs` is the real runner and is what deployment uses.
 * It cannot resolve `pg` from the repo root in this workspace layout, so this
 * exists for local work instead.
 *
 * The migrations in this project are written to be idempotent (ADD COLUMN IF
 * NOT EXISTS, guarded UPDATEs), so applying one twice is safe — which is what
 * makes this acceptable alongside the journal-driven runner rather than a
 * second source of truth.
 *
 * Keep migration SQL ASCII: a non-ASCII character executed as a raw statement
 * came back double-encoded once already.
 */
const fs = require("fs");
const path = require("path");

// Node resolves a bare require against the SCRIPT's directory, and scripts/ has
// no node_modules. `pg` is a dependency of lib/db, so ask for it from there.
const { Client } = require(require.resolve("pg", {
  paths: [path.resolve(__dirname, "..", "lib", "db")],
}));

const name = process.argv[2];
if (!name) {
  console.error("usage: node scripts/apply-migration.cjs <migration-name-without-.sql>");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
});

const file = path.join(root, "lib/db/migrations", `${name}.sql`);

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(fs.readFileSync(file, "utf8"));
    console.log(`applied ${name}`);
  } finally {
    await client.end();
  }
})().catch(err => { console.error("FAILED:", err.message); process.exit(1); });
