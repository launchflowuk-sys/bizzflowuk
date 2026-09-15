/**
 * Delete a tenant and everything belonging to it, locally.
 *
 *   node scripts/remove-tenant.cjs <slug>
 *
 * For clearing up after e2e runs and manual testing. It refuses to touch the
 * real tenants, because "delete everything for this slug" is one typo away from
 * being a very bad afternoon.
 *
 * Deletes children before parents. A naive sweep over every table with a
 * tenant_id column does not work: several child tables (quote_items,
 * payment_links, project_updates, lead_notes) have no tenant_id of their own,
 * so every parent delete stays blocked by rows the sweep cannot see.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require(require.resolve("pg", {
  paths: [path.resolve(__dirname, "..", "lib", "db")],
}));

const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/remove-tenant.cjs <slug>");
  process.exit(1);
}

/** The live businesses. Never deletable through this script. */
const PROTECTED = new Set(["amo-services", "amo-rendering", "kd-essex", "bps"]);
if (PROTECTED.has(slug)) {
  console.error(`refusing to delete "${slug}" — that is a live tenant`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
});

/** Children first. Each runs with the tenant id as $1. */
const CHILD_SQL = [
  `delete from quote_items where quote_id in (select id from quotes where tenant_id = $1)`,
  `delete from payment_links where quote_id in (select id from quotes where tenant_id = $1)`,
  `delete from project_updates where project_id in (select id from projects where tenant_id = $1)`,
  `delete from lead_notes where lead_id in (select id from leads where tenant_id = $1)`,
  `delete from certificate_appliances where certificate_id in (select id from certificates where tenant_id = $1)`,
  `delete from certificates where tenant_id = $1`,
  `delete from properties where tenant_id = $1`,
  `delete from files where tenant_id = $1`,
  `delete from invoices where tenant_id = $1`,
  `delete from expenses where tenant_id = $1`,
  `delete from projects where tenant_id = $1`,
  `delete from quotes where tenant_id = $1`,
  `delete from leads where tenant_id = $1`,
  `delete from customers where tenant_id = $1`,
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query("select id, name from tenants where slug = $1", [slug]);
    if (!rows.length) { console.log(`"${slug}" is not in this database`); return; }
    const { id, name } = rows[0];

    for (const sql of CHILD_SQL) {
      try { await client.query(sql, [id]); } catch { /* table may not exist in this schema version */ }
    }

    // Anything else tenant-scoped, swept until a pass removes nothing.
    const others = (await client.query(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'tenant_id' and table_name <> 'tenants'`
    )).rows.map(r => r.table_name);
    for (let pass = 0; pass < 8; pass++) {
      let removed = 0;
      for (const table of others) {
        try { removed += (await client.query(`delete from "${table}" where tenant_id = $1`, [id])).rowCount; }
        catch { /* blocked this pass; a later one gets it */ }
      }
      if (!removed) break;
    }

    await client.query("delete from user_tenants where tenant_id = $1", [id]);
    await client.query("delete from users where tenant_id = $1", [id]);
    await client.query("delete from tenants where id = $1", [id]);
    console.log(`removed tenant ${id} (${name})`);

    const left = (await client.query("select id, slug from tenants order by id")).rows;
    console.log("remaining:", left.map(t => `${t.id}:${t.slug}`).join("  "));
  } finally {
    await client.end();
  }
})().catch(err => { console.error("FAILED:", err.message); process.exit(1); });
