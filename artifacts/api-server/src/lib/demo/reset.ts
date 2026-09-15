import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

/**
 * Put the public demo workspace back how it was.
 *
 * Anyone can sign into the demo, so anyone can change it — delete a customer,
 * edit a quote, leave something half-finished. Left alone it degrades into a
 * mess that makes the product look worse than it is, which is the opposite of
 * what a demo is for.
 *
 * Runs in the process on a timer rather than needing an external scheduled
 * task. The automation sweep is already arranged this way and for the same
 * reason: an operational step that has to be configured per environment is a
 * step that eventually does not get configured, and then the thing looks built
 * and silently never runs.
 *
 * Safe by construction: every statement is scoped to the tenant whose slug is
 * `demo` AND whose plan is `demo`. If that tenant does not exist, this does
 * nothing at all. It can never touch a paying business.
 */

/** Rebuild at 3am-ish local time, plus once shortly after boot. */
const RESET_INTERVAL = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** The demo tenant's id, or null when there isn't one. */
async function demoTenantId(): Promise<number | null> {
  const rows = await db.execute(sql`
    select id from tenants where slug = 'demo' and plan = 'demo' limit 1
  `);
  const row = (rows as any).rows?.[0] ?? (rows as any)[0];
  return row?.id ?? null;
}

export async function resetDemoWorkspace(reason: string): Promise<{ reset: boolean }> {
  const tenantId = await demoTenantId();
  if (tenantId == null) return { reset: false };

  const startedAt = Date.now();

  // Children before parents. Several of these tables have no tenant_id of
  // their own, so a sweep over "tables with a tenant_id" cannot reach them and
  // every parent delete stays blocked.
  const statements = [
    sql`delete from quote_items where quote_id in (select id from quotes where tenant_id = ${tenantId})`,
    sql`delete from payment_links where quote_id in (select id from quotes where tenant_id = ${tenantId})`,
    sql`delete from project_updates where project_id in (select id from projects where tenant_id = ${tenantId})`,
    sql`delete from lead_notes where lead_id in (select id from leads where tenant_id = ${tenantId})`,
    sql`delete from certificate_appliances where certificate_id in (select id from certificates where tenant_id = ${tenantId})`,
    sql`delete from certificates where tenant_id = ${tenantId}`,
    sql`delete from properties where tenant_id = ${tenantId}`,
    sql`delete from files where tenant_id = ${tenantId}`,
    sql`delete from invoices where tenant_id = ${tenantId}`,
    sql`delete from expenses where tenant_id = ${tenantId}`,
    sql`delete from projects where tenant_id = ${tenantId}`,
    sql`delete from quotes where tenant_id = ${tenantId}`,
    sql`delete from leads where tenant_id = ${tenantId}`,
    sql`delete from customers where tenant_id = ${tenantId}`,
  ];
  for (const statement of statements) {
    try { await db.execute(statement); } catch { /* table may not exist in this schema version */ }
  }

  await seedDemoData(tenantId);
  logger.info({ tenantId, reason, ms: Date.now() - startedAt }, "Demo workspace reset");
  return { reset: true };
}

/**
 * The fictional business. Everything here is invented — Oak & Stone and every
 * person named are made up, and no real customer, address or number appears.
 *
 * Dates are relative to now, so the demo never looks abandoned: the overdue
 * invoice is always genuinely overdue and the expiring certificate is always
 * genuinely about to expire.
 */
async function seedDemoData(tenantId: number) {
  const customers: number[] = [];
  for (const [first, last, email, phone, town] of [
    ["Sarah", "Mitchell", "sarah.mitchell@example.invalid", "07700 900101", "Chelmsford"],
    ["David", "Thompson", "david.thompson@example.invalid", "07700 900102", "Brentwood"],
    ["Oakfield", "Developments", "site@oakfield.example.invalid", "07700 900103", "Billericay"],
    ["Emily", "Roberts", "emily.roberts@example.invalid", "07700 900104", "Upminster"],
  ]) {
    const r: any = await db.execute(sql`
      insert into customers (tenant_id, first_name, last_name, email, phone, city)
      values (${tenantId}, ${first}, ${last}, ${email}, ${phone}, ${town}) returning id`);
    customers.push((r.rows?.[0] ?? r[0]).id);
  }

  let leadNo = 0;
  for (const [first, last, service, status, daysAgo, source] of [
    ["Thomas", "Wilson", "Garden design & landscaping", "New", 2, "Google"],
    ["Priya", "Shah", "Driveway replacement", "New", 9, "QR code"],
    ["Mark", "Ellis", "Patio and decking", "Contacted", 14, "Google"],
    ["Sarah", "Mitchell", "Garden transformation", "Won", 40, "Referral"],
    ["Gareth", "Lloyd", "Fencing", "Lost", 55, "Google"],
  ] as Array<[string, string, string, string, number, string]>) {
    leadNo += 1;
    const ref = `OAK-L-${String(leadNo).padStart(4, "0")}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.invalid`;
    await db.execute(sql`
      insert into leads (tenant_id, reference, first_name, last_name, email, phone,
                         service_interest, status, source, created_at)
      values (${tenantId}, ${ref}, ${first}, ${last}, ${email}, '07700 900200',
              ${service}, ${status}, ${source}, now() - (${daysAgo} || ' days')::interval)`);
  }

  const quotes: number[] = [];
  for (const [ref, idx, total, status] of [
    ["OAK-0084", 0, 6400, "Sent"], ["OAK-0083", 1, 4250, "Accepted"],
    ["OAK-0082", 2, 8400, "Accepted"], ["OAK-0081", 3, 1850, "Draft"],
  ] as Array<[string, number, number, string]>) {
    const net = (total / 1.2).toFixed(2);
    const vat = (total - total / 1.2).toFixed(2);
    const r: any = await db.execute(sql`
      insert into quotes (tenant_id, customer_id, reference, status, subtotal, vat_rate, vat_amount, total)
      values (${tenantId}, ${customers[idx]}, ${ref}, ${status}, ${net}, '20.00', ${vat}, ${total.toFixed(2)})
      returning id`);
    quotes.push((r.rows?.[0] ?? r[0]).id);
  }

  for (const [title, idx, status, quoteIdx] of [
    ["Oakfield garden transformation", 0, "In Progress", 1],
    ["Kitchen courtyard rebuild", 1, "In Progress", 2],
    ["Driveway installation", 2, "Scheduled", null],
    ["Rear patio and steps", 3, "Completed", null],
  ] as Array<[string, number, string, number | null]>) {
    const quoteId = quoteIdx === null ? null : quotes[quoteIdx];
    await db.execute(sql`
      insert into projects (tenant_id, customer_id, quote_id, title, status)
      values (${tenantId}, ${customers[idx]}, ${quoteId}, ${title}, ${status})`);
  }

  for (const [ref, idx, total, status, dueOffset, paidOffset] of [
    ["OAK-INV-0026", 0, 1275, "paid", -20, -18],
    ["OAK-INV-0025", 3, 2800, "sent", -12, null],
    ["OAK-INV-0024", 2, 3600, "paid", -30, -28],
    ["OAK-INV-0027", 1, 4200, "sent", 14, null],
  ] as Array<[string, number, number, string, number, number | null]>) {
    const net = (total / 1.2).toFixed(2);
    const vat = (total - total / 1.2).toFixed(2);
    const paidAt = paidOffset === null ? null : sql`now() + (${paidOffset} || ' days')::interval`;
    await db.execute(sql`
      insert into invoices (tenant_id, customer_id, reference, status, subtotal, vat_rate, vat_amount,
                            total, issued_on, due_on, paid_at, amount_paid)
      values (${tenantId}, ${customers[idx]}, ${ref}, ${status}, ${net}, '20.00', ${vat},
              ${total.toFixed(2)},
              (now() + (${dueOffset - 14} || ' days')::interval)::date,
              (now() + (${dueOffset} || ' days')::interval)::date,
              ${paidAt},
              ${status === "paid" ? total.toFixed(2) : "0.00"})`);
  }

  for (const [supplier, category, total, daysAgo] of [
    ["Travis Perkins", "materials", 842.6, 4], ["Jewson", "materials", 1245, 11],
    ["Shell", "fuel", 96.4, 2], ["Hire Station", "tools", 180, 8],
  ] as Array<[string, string, number, number]>) {
    const net = (total / 1.2).toFixed(2);
    const vat = (total - total / 1.2).toFixed(2);
    await db.execute(sql`
      insert into expenses (tenant_id, supplier, category, spent_on, net, vat_amount, total)
      values (${tenantId}, ${supplier}, ${category},
              (now() - (${daysAgo} || ' days')::interval)::date, ${net}, ${vat}, ${total.toFixed(2)})`);
  }

  const properties: number[] = [];
  for (const [line1, unit, town, postcode, idx] of [
    ["42 Maple Avenue", null, "Grays", "RM17 5DB", 0],
    ["12 High Street", "Flat 3", "Grays", "RM16 2AB", 2],
    ["8 Oakfield Rise", null, "Billericay", "CM12 9PL", 2],
  ] as Array<[string, string | null, string, string, number]>) {
    const r: any = await db.execute(sql`
      insert into properties (tenant_id, customer_id, address_line1, unit, city, postcode, tenant_name, tenant_phone)
      values (${tenantId}, ${customers[idx]}, ${line1}, ${unit}, ${town}, ${postcode}, 'Occupier', '07700 900300')
      returning id`);
    properties.push((r.rows?.[0] ?? r[0]).id);
  }

  let certNo = 0;
  for (const [propIdx, expiresIn] of [[0, 28], [1, 120], [2, -6]] as Array<[number, number]>) {
    certNo += 1;
    const ref = `OAK-GS-${String(certNo).padStart(4, "0")}`;
    await db.execute(sql`
      insert into certificates (tenant_id, type, reference, status, property_id, property_address,
                                property_postcode, checked_at, expires_at, issued_at, imported, data)
      values (${tenantId}, 'gas_safety', ${ref}, 'issued', ${properties[propIdx]},
              'Demo property', 'RM17 5DB',
              (now() + (${expiresIn - 365} || ' days')::interval)::date,
              (now() + (${expiresIn} || ' days')::interval)::date,
              now() + (${expiresIn - 365} || ' days')::interval,
              false, '{}'::jsonb)`);
  }
}

export function startDemoResetScheduler(): void {
  if (timer) return;

  const run = async (reason: string) => {
    if (running) return;
    running = true;
    try {
      await resetDemoWorkspace(reason);
    } catch (err) {
      // A failed reset must never take the server down — the demo being stale
      // is a much smaller problem than the API falling over.
      logger.error({ err, reason }, "Demo workspace reset failed");
    } finally {
      running = false;
    }
  };

  setTimeout(() => { void run("first run after boot"); }, FIRST_RUN_DELAY);
  timer = setInterval(() => { void run("daily"); }, RESET_INTERVAL);
  logger.info("Demo reset scheduler started — daily");
}
