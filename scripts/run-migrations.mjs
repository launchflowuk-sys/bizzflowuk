#!/usr/bin/env node
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "fs";
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

// Migrations added AFTER the database was first stood up. Everything before these was created
// on the original database by `drizzle-kit push` (schema-sync), which never records anything in
// drizzle's migration-tracking table. See baselineIfNeeded() below.
const POST_PUSH_MIGRATIONS = new Set([
  "0012_construction_lead_fields",
  "0013_price_items",
  "0014_calculator_estimate_lead",
  "0015_user_tenants",
]);

/**
 * Adopts a push-initialized database into the migration system.
 *
 * The original DB was created with `drizzle-kit push`, which builds the schema directly and
 * leaves drizzle.__drizzle_migrations empty. drizzle's migrator, seeing an empty tracking table,
 * tries to run EVERY migration from 0000 — whose `CREATE TABLE users …` immediately fails
 * ("already exists"), and because all pending migrations run in one transaction, the whole batch
 * (including every new migration) rolls back. That's why new tables never appeared in prod.
 *
 * Fix: if tracking is empty but the schema already exists (users table present), record the
 * pre-existing migrations as already-applied — WITHOUT running their SQL — so migrate() then
 * applies only the genuinely new ones. Strictly guarded so it never touches a normally-tracked
 * DB and never runs on a truly fresh one (where migrate() correctly builds everything).
 */
async function baselineIfNeeded(pool) {
  await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await pool.query('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" ("id" SERIAL PRIMARY KEY, "hash" text NOT NULL, "created_at" bigint)');

  const { rows: cntRows } = await pool.query('SELECT count(*)::int AS c FROM "drizzle"."__drizzle_migrations"');
  const tracked = cntRows[0].c;
  const { rows: usersRows } = await pool.query("SELECT to_regclass('public.users') IS NOT NULL AS has");
  const schemaExists = usersRows[0].has;
  console.log(`    Tracking rows: ${tracked} | schema already present: ${schemaExists}`);

  if (tracked > 0 || !schemaExists) return; // normal tracked DB, or genuinely fresh DB — nothing to do

  const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
  let baselined = 0;
  for (const entry of journal.entries) {
    if (POST_PUSH_MIGRATIONS.has(entry.tag)) continue; // let migrate() actually run the new ones
    const sql = fs.readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    // created_at = the journal `when`; migrate() applies only migrations whose `when` exceeds the
    // latest recorded created_at, so recording up to 0011 makes it run 0012+ and nothing else.
    await pool.query('INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)', [hash, entry.when]);
    baselined++;
  }
  console.log(`==> Baselined ${baselined} pre-existing migrations (push-initialized DB adopted); only new migrations will run`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await baselineIfNeeded(pool);
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder });
  console.log("==> Migrations completed successfully");
} catch (err) {
  // Every migration file is written to be idempotent (IF NOT EXISTS / guarded DO blocks) so a
  // genuine failure here always means something real is wrong — never swallow it. Fail loudly so
  // Coolify's deploy logs show the truth.
  const msg = String(err?.message ?? err ?? "");
  console.error("==> Migration failed:", msg);
  process.exit(1);
} finally {
  await pool.end();
}
