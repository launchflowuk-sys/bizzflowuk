#!/usr/bin/env node
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import path from "path";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../lib/db/migrations");

console.log("==> LaunchFlow database migration");
console.log(`    Migrations folder: ${migrationsFolder}`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  console.log("==> Migrations completed successfully");
} catch (err) {
  // Every migration file is written to be idempotent (IF NOT EXISTS / guarded
  // DO blocks) specifically so a genuine failure here always means something
  // real is wrong — never swallow "already exists"-shaped errors as if they
  // meant the whole migration set must already be applied. That fallback used
  // to live here and silently reported success on a partially-applied
  // database (a mid-transaction failure rolls back everything in that file,
  // not just the failing statement), which took real production debugging to
  // catch. Let it fail loudly so Coolify's deploy logs show the truth.
  const msg = String(err?.message ?? err ?? "");
  console.error("==> Migration failed:", msg);
  process.exit(1);
} finally {
  await pool.end();
}
