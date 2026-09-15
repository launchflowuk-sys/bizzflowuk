/**
 * Create or reset the public demo tenant.
 *
 *   node scripts/seed-demo-tenant.cjs
 *
 * This is a REAL tenant in the real database, seen through the real dashboard.
 * That is the point: a mock-up shows prospects a drawing of the product, and
 * the moment they sign up they find something that does not match. This shows
 * them the actual thing.
 *
 * Safety, because a publicly reachable account needs it:
 *
 *  - Everything in it is invented. Oak & Stone and every person named here are
 *    fictional; no real customer, address or phone number appears.
 *  - It is an ordinary tenant, so every tenant filter in the codebase applies to
 *    it exactly as to a paying business. A demo visitor cannot see anyone else's
 *    data for the same reason BPS cannot see AMO's.
 *  - Re-running this wipes and rebuilds it, so anything a visitor types is
 *    temporary. Point a scheduled task at it to reset nightly.
 *
 * Idempotent: safe to run again at any time.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require(require.resolve("pg", {
  paths: [path.resolve(__dirname, "..", "lib", "db"), path.resolve(__dirname, "..", "artifacts", "api-server")],
}));
const bcrypt = require(require.resolve("bcryptjs", {
  paths: [path.resolve(__dirname, "..", "artifacts", "api-server")],
}));

const root = path.resolve(__dirname, "..");
fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
});

const SLUG = "demo";
const EMAIL = process.env.DEMO_EMAIL || "demo@bizzflowuk.com";
const PASSWORD = process.env.DEMO_PASSWORD || "demo-workspace-2026";

/** Dates relative to now, so the demo never looks stale. */
const day = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const iso = d => d.toISOString().slice(0, 10);

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("begin");

    // ── Reset ───────────────────────────────────────────────────────────────
    const existing = (await c.query("select id from tenants where slug = $1", [SLUG])).rows[0];
    if (existing) {
      const id = existing.id;
      const child = [
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
      for (const sql of child) { try { await c.query(sql, [id]); } catch {} }
      const others = (await c.query(
        `select table_name from information_schema.columns
         where table_schema='public' and column_name='tenant_id' and table_name not in ('tenants','tenant_settings')`
      )).rows.map(r => r.table_name);
      for (let p = 0; p < 6; p++) {
        let n = 0;
        for (const t of others) { try { n += (await c.query(`delete from "${t}" where tenant_id=$1`, [id])).rowCount; } catch {} }
        if (!n) break;
      }
    }

    // ── Tenant ──────────────────────────────────────────────────────────────
    const tenantId = existing?.id ?? (await c.query(
      `insert into tenants (name, slug, industry, plan, email, phone, country)
       values ($1,$2,$3,$4,$5,$6,'GB') returning id`,
      ["Oak & Stone Landscapes", SLUG, "landscaping", "demo", EMAIL, "01375 000000"]
    )).rows[0].id;

    await c.query(
      `update tenants set name=$2, industry=$3, plan='demo', showcase_order=null where id=$1`,
      [tenantId, "Oak & Stone Landscapes", "landscaping"]
    );

    await c.query(
      `insert into tenant_settings (tenant_id, email, phone, primary_color, quote_ref_prefix, service_base, service_area)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (tenant_id) do update set primary_color = excluded.primary_color,
         service_base = excluded.service_base, service_area = excluded.service_area`,
      [tenantId, EMAIL, "01375 000000", "#0F766E", "OAK", "Grays",
       "Grays, Chelmsford, Brentwood, Billericay and across South Essex"]
    );

    // ── The person who signs in ─────────────────────────────────────────────
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = (await c.query(
      `insert into users (tenant_id, email, first_name, last_name, role, password_hash)
       values ($1,$2,'James','Taylor','TENANT_ADMIN',$3)
       on conflict (email) do update set password_hash = excluded.password_hash, tenant_id = excluded.tenant_id
       returning id`,
      [tenantId, EMAIL, hash]
    )).rows[0];
    await c.query(
      `insert into user_tenants (user_id, tenant_id, role) values ($1,$2,'TENANT_ADMIN')
       on conflict do nothing`, [user.id, tenantId]
    );

    // ── Customers ───────────────────────────────────────────────────────────
    const customers = [];
    for (const [first, last, email, phone, town] of [
      ["Sarah", "Mitchell", "sarah.mitchell@example.invalid", "07700 900101", "Chelmsford"],
      ["David", "Thompson", "david.thompson@example.invalid", "07700 900102", "Brentwood"],
      ["Oakfield", "Developments", "site@oakfield.example.invalid", "07700 900103", "Billericay"],
      ["Emily", "Roberts", "emily.roberts@example.invalid", "07700 900104", "Upminster"],
    ]) {
      customers.push((await c.query(
        `insert into customers (tenant_id, first_name, last_name, email, phone, city)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [tenantId, first, last, email, phone, town]
      )).rows[0].id);
    }

    // ── Leads, at several stages ────────────────────────────────────────────
    let leadNo = 0;
    for (const [first, last, service, status, daysAgo] of [
      ["Thomas", "Wilson", "Garden design & landscaping", "New", 2],
      ["Priya", "Shah", "Driveway replacement", "New", 9],
      ["Mark", "Ellis", "Patio and decking", "Contacted", 14],
      ["Sarah", "Mitchell", "Garden transformation", "Won", 40],
      ["Gareth", "Lloyd", "Fencing", "Lost", 55],
    ]) {
      leadNo += 1;
      await c.query(
        `insert into leads (tenant_id, reference, first_name, last_name, email, phone, service_interest, status, source, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenantId, `OAK-L-${String(leadNo).padStart(4, "0")}`, first, last,
         `${first.toLowerCase()}.${last.toLowerCase()}@example.invalid`, "07700 900200",
         service, status, leadNo % 2 ? "Google" : "QR code", day(-daysAgo)]
      );
    }

    // ── Quotes ──────────────────────────────────────────────────────────────
    const quotes = [];
    for (const [ref, customerIdx, total, status] of [
      ["OAK-0084", 0, "6400.00", "Sent"],
      ["OAK-0083", 1, "4250.00", "Accepted"],
      ["OAK-0082", 2, "8400.00", "Accepted"],
      ["OAK-0081", 3, "1850.00", "Draft"],
    ]) {
      quotes.push((await c.query(
        `insert into quotes (tenant_id, customer_id, reference, status, subtotal, vat_rate, vat_amount, total)
         values ($1,$2,$3,$4,$5,'20.00',$6,$7) returning id`,
        [tenantId, customers[customerIdx], ref, status,
         (Number(total) / 1.2).toFixed(2), (Number(total) - Number(total) / 1.2).toFixed(2), total]
      )).rows[0].id);
    }

    // ── Projects ────────────────────────────────────────────────────────────
    for (const [name, customerIdx, status, quoteIdx] of [
      ["Oakfield garden transformation", 0, "In Progress", 1],
      ["Kitchen courtyard rebuild", 1, "In Progress", 2],
      ["Driveway installation", 2, "Scheduled", null],
      ["Rear patio and steps", 3, "Completed", null],
    ]) {
      await c.query(
        // projects.title, not name — and status is a pg enum, so only the six
        // declared values are accepted.
        `insert into projects (tenant_id, customer_id, quote_id, title, status)
         values ($1,$2,$3,$4,$5)`,
        [tenantId, customers[customerIdx], quoteIdx !== null ? quotes[quoteIdx] : null, name, status]
      );
    }

    // ── Invoices, including one deliberately overdue ─────────────────────────
    for (const [ref, customerIdx, total, status, dueOffset, paidOffset] of [
      ["OAK-INV-0026", 0, "1275.00", "paid", -20, -18],
      ["OAK-INV-0025", 3, "2800.00", "sent", -12, null],
      ["OAK-INV-0024", 2, "3600.00", "paid", -30, -28],
      ["OAK-INV-0027", 1, "4200.00", "sent", 14, null],
    ]) {
      await c.query(
        `insert into invoices (tenant_id, customer_id, reference, status, subtotal, vat_rate, vat_amount, total,
                               issued_on, due_on, paid_at, amount_paid)
         values ($1,$2,$3,$4,$5,'20.00',$6,$7,$8,$9,$10,$11)`,
        [tenantId, customers[customerIdx], ref, status,
         (Number(total) / 1.2).toFixed(2), (Number(total) - Number(total) / 1.2).toFixed(2), total,
         iso(day(dueOffset - 14)), iso(day(dueOffset)),
         paidOffset !== null ? day(paidOffset) : null,
         status === "paid" ? total : "0.00"]
      );
    }

    // ── Expenses ────────────────────────────────────────────────────────────
    for (const [supplier, category, total, daysAgo] of [
      ["Travis Perkins", "materials", "842.60", 4],
      ["Jewson", "materials", "1245.00", 11],
      ["Shell", "fuel", "96.40", 2],
      ["Hire Station", "tools", "180.00", 8],
    ]) {
      await c.query(
        `insert into expenses (tenant_id, supplier, category, spent_on, net, vat_amount, total)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [tenantId, supplier, category, iso(day(-daysAgo)),
         (Number(total) / 1.2).toFixed(2), (Number(total) - Number(total) / 1.2).toFixed(2), total]
      );
    }

    // ── Properties and certificates ─────────────────────────────────────────
    const properties = [];
    for (const [line1, unit, town, postcode, customerIdx] of [
      ["42 Maple Avenue", null, "Grays", "RM17 5DB", 0],
      ["12 High Street", "Flat 3", "Grays", "RM16 2AB", 2],
      ["8 Oakfield Rise", null, "Billericay", "CM12 9PL", 2],
    ]) {
      properties.push((await c.query(
        `insert into properties (tenant_id, customer_id, address_line1, unit, city, postcode, tenant_name, tenant_phone)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [tenantId, customers[customerIdx], line1, unit, town, postcode, "Occupier", "07700 900300"]
      )).rows[0].id);
    }

    let certNo = 0;
    for (const [propIdx, expiresIn] of [[0, 28], [1, 120], [2, -6]]) {
      certNo += 1;
      await c.query(
        `insert into certificates (tenant_id, type, reference, status, property_id, property_address, property_postcode,
                                   checked_at, expires_at, issued_at, imported, data)
         values ($1,'gas_safety',$2,'issued',$3,$4,$5,$6,$7,$8,false,'{}'::jsonb)`,
        [tenantId, `OAK-GS-${String(certNo).padStart(4, "0")}`, properties[propIdx],
         "Demo property", "RM17 5DB", iso(day(expiresIn - 365)), iso(day(expiresIn)), day(expiresIn - 365)]
      );
    }

    await c.query("commit");

    console.log(`Demo tenant ready.`);
    console.log(`  slug:     ${SLUG}  (id ${tenantId})`);
    console.log(`  sign in:  ${EMAIL} / ${PASSWORD}`);
    console.log(`  data:     ${customers.length} customers, ${leadNo} leads, ${quotes.length} quotes, 4 invoices, 3 properties, ${certNo} certificates`);
  } catch (err) {
    await c.query("rollback").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
})().catch(err => { console.error("FAILED:", err.message); process.exit(1); });
