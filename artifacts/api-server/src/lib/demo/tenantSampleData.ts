import {
  db, customersTable, leadsTable, quotesTable, quoteItemsTable,
  projectsTable, projectItemsTable, projectUpdatesTable,
  invoicesTable, invoiceItemsTable, invoicePaymentsTable,
  expensesTable, contactMessagesTable, propertiesTable,
  servicesTable, usersTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logger } from "../logger";

/**
 * Fill a real tenant with believable sample data for a walkthrough, and take
 * it out again afterwards.
 *
 * An empty dashboard sells nothing. Every list says "no invoices yet", every
 * total is zero, and the person being shown it has to imagine the product
 * instead of seeing it. This lights the whole thing up: work in the diary this
 * week, invoices in every state including one overdue, a certificate coming up
 * for renewal, money in and money out.
 *
 * REMOVAL IS THE POINT, and it is why every row carries `is_demo` (migration
 * 0049) rather than a marker typed into a notes field. BPS is a live business:
 * "delete everything for this tenant" would take Brandon's real work with it,
 * and matching on text both shows up on screen during the demo and deletes
 * whatever a real user happened to type the same words into. `where tenant_id
 * = X and is_demo` cannot touch a real row even in principle.
 *
 * Everything here is invented. No real customer, address, or phone number
 * appears — the names are made up and the numbers are Ofcom's reserved drama
 * range, which can never connect to a real person.
 */

/** Days from now, at a given hour, as a Date. */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** YYYY-MM-DD, offset by days. Local, never toISOString on a Date with a time. */
function dateOnly(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CUSTOMERS = [
  { firstName: "Denise", lastName: "Hartley", email: "denise.hartley@example.com", phone: "07700 900142", address: "18 Chadwell Road", city: "Grays", postcode: "RM17 6LG" },
  { firstName: "Marcus", lastName: "Ellery", email: "marcus.ellery@example.com", phone: "07700 900318", address: "7 Kingsley Gardens", city: "Chafford Hundred", postcode: "RM16 6RT" },
  { firstName: "Priya", lastName: "Raman", email: "priya.raman@example.com", phone: "07700 900577", address: "44 Orsett Road", city: "Grays", postcode: "RM17 5EF" },
  { firstName: "Tom", lastName: "Beckworth", email: "tom.beckworth@example.com", phone: "07700 900904", address: "2 Wharf Lane", city: "Tilbury", postcode: "RM18 7HN" },
  { firstName: "Angela", lastName: "Moss", email: "angela.moss@example.com", phone: "07700 900233", address: "91 Stanford Road", city: "Stanford-le-Hope", postcode: "SS17 0EL" },
];

export type SampleResult = { seeded: boolean; counts: Record<string, number> };

export async function seedTenantSampleData(tenantId: number): Promise<SampleResult> {
  const counts: Record<string, number> = {};

  // Already seeded? Adding a second set would double every total on screen.
  const [{ n } = { n: 0 } as any] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.isDemo, true)));
  if (Number(n) > 0) return { seeded: false, counts: { existing: Number(n) } };

  // Whoever the jobs get assigned to, so the diary is not full of "Unassigned".
  const [engineer] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.tenantId, tenantId)).limit(1);

  const services = await db.select({ id: servicesTable.id, name: servicesTable.name })
    .from(servicesTable).where(eq(servicesTable.tenantId, tenantId)).limit(6);
  const serviceId = (i: number) => services.length ? services[i % services.length].id : null;

  // ── People ─────────────────────────────────────────────────────────────────
  const customers = await db.insert(customersTable)
    .values(CUSTOMERS.map(c => ({ ...c, tenantId, isDemo: true })))
    .returning({ id: customersTable.id });
  counts.customers = customers.length;

  // ── Enquiries at different stages of going cold ────────────────────────────
  const leads = await db.insert(leadsTable).values([
    {
      tenantId, isDemo: true, reference: "DEMO-L-001", status: "New", source: "Website",
      serviceInterest: "Boiler repair", firstName: "Gemma", lastName: "Whitlock",
      email: "gemma.whitlock@example.com", phone: "07700 900461",
      address: "12 Bridge Road", city: "Grays", postcode: "RM17 6BU",
      notes: "No hot water since last night. Combi is making a rattling noise. Asked if today is possible.",
    },
    {
      tenantId, isDemo: true, reference: "DEMO-L-002", status: "Contacted", source: "Google",
      serviceInterest: "Bathroom installation", firstName: "Owen", lastName: "Pryce",
      email: "owen.pryce@example.com", phone: "07700 900712",
      address: "5 Hillcrest Avenue", city: "Corringham", postcode: "SS17 9DP",
      notes: "Wants a full bathroom refit in the spring. Sending photos through.",
    },
    {
      tenantId, isDemo: true, reference: "DEMO-L-003", status: "Quote Sent", source: "Referral",
      serviceInterest: "Central heating", firstName: "Nadia", lastName: "Kaur",
      email: "nadia.kaur@example.com", phone: "07700 900855",
      address: "30 Lodge Lane", city: "Grays", postcode: "RM16 2UD",
      notes: "Recommended by a neighbour. Three radiators not heating upstairs.",
    },
    {
      tenantId, isDemo: true, reference: "DEMO-L-004", status: "Won", source: "Website",
      serviceInterest: "Boiler installation", firstName: "Denise", lastName: "Hartley",
      email: "denise.hartley@example.com", phone: "07700 900142",
      address: "18 Chadwell Road", city: "Grays", postcode: "RM17 6LG",
      notes: "Accepted the quote on the day. Booked in.",
    },
  ]).returning({ id: leadsTable.id });
  counts.leads = leads.length;

  // ── Quotes ─────────────────────────────────────────────────────────────────
  const quotes = await db.insert(quotesTable).values([
    {
      tenantId, isDemo: true, customerId: customers[2].id, reference: "DEMO-QUO-0001",
      status: "Sent", subtotal: "4850.00", total: "4850.00",
      notes: "Full bathroom refit — supply and fit, two weeks' work.",
      sentAt: at(-6, 10),
    },
    {
      tenantId, isDemo: true, customerId: customers[0].id, reference: "DEMO-QUO-0002",
      status: "Accepted", subtotal: "2340.00", total: "2340.00",
      notes: "Boiler replacement, Worcester Bosch, 10-year guarantee.",
      sentAt: at(-14, 9),
    },
    {
      tenantId, isDemo: true, customerId: customers[4].id, reference: "DEMO-QUO-0003",
      status: "Draft", subtotal: "680.00", total: "680.00",
      notes: "Power flush and two replacement radiators. Waiting on a delivery date before sending.",
    },
  ]).returning({ id: quotesTable.id });
  counts.quotes = quotes.length;

  await db.insert(quoteItemsTable).values([
    { quoteId: quotes[0].id, description: "Strip out existing bathroom and dispose", quantity: "1", unitPrice: "450.00", total: "450.00", sortOrder: 0 },
    { quoteId: quotes[0].id, description: "Supply and fit bathroom suite", quantity: "1", unitPrice: "2600.00", total: "2600.00", sortOrder: 1 },
    { quoteId: quotes[0].id, description: "Tiling, walls and floor", quantity: "1", unitPrice: "1200.00", total: "1200.00", sortOrder: 2 },
    { quoteId: quotes[0].id, description: "Electrics — shower and extractor", quantity: "1", unitPrice: "600.00", total: "600.00", sortOrder: 3 },
    { quoteId: quotes[1].id, description: "Worcester Bosch Greenstar 4000 combi, supplied and fitted", quantity: "1", unitPrice: "1980.00", total: "1980.00", sortOrder: 0 },
    { quoteId: quotes[1].id, description: "Magnetic filter and chemical flush", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 1 },
    { quoteId: quotes[1].id, description: "Labour", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 2 },
    { quoteId: quotes[2].id, description: "Full system power flush", quantity: "1", unitPrice: "420.00", total: "420.00", sortOrder: 0 },
    { quoteId: quotes[2].id, description: "Replacement radiator, fitted", quantity: "2", unitPrice: "130.00", total: "260.00", sortOrder: 1 },
  ]);

  // ── Jobs across the week, so the diary has something in it ─────────────────
  const jobs = await db.insert(projectsTable).values([
    {
      tenantId, isDemo: true, customerId: customers[0].id, serviceId: serviceId(0),
      title: "Boiler replacement — Chadwell Road", status: "Scheduled",
      description: "Side gate is unlocked. Old boiler is in the airing cupboard upstairs.",
      address: "18 Chadwell Road", city: "Grays", postcode: "RM17 6LG",
      scheduledStart: at(0, 8, 30), scheduledEnd: at(0, 16, 0),
      assignedUserId: engineer?.id ?? null,
    },
    {
      tenantId, isDemo: true, customerId: customers[1].id, serviceId: serviceId(1),
      title: "Annual boiler service", status: "Scheduled",
      description: "Regular customer, second year.",
      address: "7 Kingsley Gardens", city: "Chafford Hundred", postcode: "RM16 6RT",
      scheduledStart: at(1, 9, 0), scheduledEnd: at(1, 10, 30),
      assignedUserId: engineer?.id ?? null,
    },
    {
      tenantId, isDemo: true, customerId: customers[2].id, serviceId: serviceId(2),
      title: "Leaking shower mixer", status: "Scheduled",
      description: "Parking on the road, permit not needed before 10am.",
      address: "44 Orsett Road", city: "Grays", postcode: "RM17 5EF",
      scheduledStart: at(1, 13, 0), scheduledEnd: at(1, 15, 0),
      assignedUserId: engineer?.id ?? null,
    },
    {
      tenantId, isDemo: true, customerId: customers[3].id, serviceId: serviceId(3),
      title: "Landlord gas safety check — Wharf Lane", status: "Scheduled",
      description: "Tenant works shifts — confirm access the day before.",
      address: "2 Wharf Lane", city: "Tilbury", postcode: "RM18 7HN",
      scheduledStart: at(3, 11, 0), scheduledEnd: at(3, 12, 0),
      assignedUserId: engineer?.id ?? null,
    },
    {
      tenantId, isDemo: true, customerId: customers[4].id, serviceId: serviceId(4),
      title: "Radiator replacement — Stanford Road", status: "Completed",
      description: "Two upstairs radiators swapped, system rebalanced.",
      address: "91 Stanford Road", city: "Stanford-le-Hope", postcode: "SS17 0EL",
      scheduledStart: at(-9, 8, 30), scheduledEnd: at(-9, 14, 0),
      completedAt: at(-9, 14, 0), assignedUserId: engineer?.id ?? null,
    },
    {
      tenantId, isDemo: true, customerId: customers[1].id, serviceId: serviceId(0),
      title: "Kitchen tap replacement", status: "Completed",
      description: "Supplied by the customer.",
      address: "7 Kingsley Gardens", city: "Chafford Hundred", postcode: "RM16 6RT",
      scheduledStart: at(-21, 15, 0), scheduledEnd: at(-21, 16, 30),
      completedAt: at(-21, 16, 30), assignedUserId: engineer?.id ?? null,
    },
  ]).returning({ id: projectsTable.id });
  counts.jobs = jobs.length;

  await db.insert(projectItemsTable).values([
    { projectId: jobs[0].id, description: "Worcester Bosch Greenstar 4000 combi", quantity: "1", unitPrice: "1980.00", total: "1980.00", sortOrder: 0 },
    { projectId: jobs[0].id, description: "Magnetic filter and flush", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 1 },
    { projectId: jobs[0].id, description: "Labour, full day", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 2 },
    { projectId: jobs[2].id, description: "Shower mixer cartridge", quantity: "1", unitPrice: "48.00", total: "48.00", sortOrder: 0 },
    { projectId: jobs[2].id, description: "Labour, 2 hours", quantity: "2", unitPrice: "45.00", total: "90.00", sortOrder: 1 },
  ]);

  await db.insert(projectUpdatesTable).values([
    { projectId: jobs[4].id, title: "Job finished", content: "Both radiators replaced and the system rebalanced. Showed the customer how to bleed them.", visibleToCustomer: true },
    { projectId: jobs[0].id, title: "Parts ordered", content: "Boiler and filter ordered from the merchant, due in the day before.", visibleToCustomer: false },
  ]);

  // ── Invoices, one in each state that matters ───────────────────────────────
  const invoices = await db.insert(invoicesTable).values([
    {
      tenantId, isDemo: true, customerId: customers[4].id, projectId: jobs[4].id,
      reference: "DEMO-INV-0001", status: "paid",
      issuedOn: dateOnly(-9), dueOn: dateOnly(5),
      subtotal: "640.00", vatAmount: "0.00", cisDeduction: "0.00", total: "640.00", amountPaid: "640.00",
      paidAt: at(-4, 12), sentAt: at(-9, 17),
      notes: "Thanks again — any trouble with the balancing, give me a ring.",
    },
    {
      tenantId, isDemo: true, customerId: customers[1].id, projectId: jobs[5].id,
      reference: "DEMO-INV-0002", status: "sent",
      issuedOn: dateOnly(-21), dueOn: dateOnly(-7),
      subtotal: "95.00", vatAmount: "0.00", cisDeduction: "0.00", total: "95.00", amountPaid: "0.00",
      sentAt: at(-21, 18),
      notes: "Kitchen tap replacement.",
    },
    {
      tenantId, isDemo: true, customerId: customers[2].id,
      reference: "DEMO-INV-0003", status: "part_paid",
      issuedOn: dateOnly(-12), dueOn: dateOnly(2),
      subtotal: "1400.00", vatAmount: "0.00", cisDeduction: "0.00", total: "1400.00", amountPaid: "500.00",
      sentAt: at(-12, 9),
      notes: "Deposit received, balance on completion.",
    },
    {
      tenantId, isDemo: true, customerId: customers[0].id, projectId: jobs[0].id,
      reference: "DEMO-INV-0004", status: "draft",
      issuedOn: dateOnly(0), dueOn: dateOnly(14),
      subtotal: "2340.00", vatAmount: "0.00", cisDeduction: "0.00", total: "2340.00", amountPaid: "0.00",
      notes: "Raise on completion of the boiler swap.",
    },
  ]).returning({ id: invoicesTable.id });
  counts.invoices = invoices.length;

  await db.insert(invoiceItemsTable).values([
    { invoiceId: invoices[0].id, description: "Replacement radiator, supplied and fitted", quantity: "2", unitPrice: "230.00", total: "460.00", sortOrder: 0 },
    { invoiceId: invoices[0].id, description: "System rebalance", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 1 },
    { invoiceId: invoices[1].id, description: "Kitchen tap fitted (part supplied by customer)", quantity: "1", unitPrice: "95.00", total: "95.00", sortOrder: 0 },
    { invoiceId: invoices[2].id, description: "Bathroom refit — first stage", quantity: "1", unitPrice: "1400.00", total: "1400.00", sortOrder: 0 },
    { invoiceId: invoices[3].id, description: "Worcester Bosch Greenstar 4000 combi, supplied and fitted", quantity: "1", unitPrice: "1980.00", total: "1980.00", sortOrder: 0 },
    { invoiceId: invoices[3].id, description: "Magnetic filter and chemical flush", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 1 },
    { invoiceId: invoices[3].id, description: "Labour", quantity: "1", unitPrice: "180.00", total: "180.00", sortOrder: 2 },
  ]);

  await db.insert(invoicePaymentsTable).values([
    { invoiceId: invoices[0].id, amount: "640.00", paidOn: dateOnly(-4), method: "bank_transfer", reference: "DEMO-INV-0001" },
    { invoiceId: invoices[2].id, amount: "500.00", paidOn: dateOnly(-11), method: "card", reference: "Deposit" },
  ]);

  // ── Money going out, including one delivery that has not turned up ─────────
  await db.insert(expensesTable).values([
    { tenantId, isDemo: true, supplier: "City Plumbing", category: "materials", spentOn: dateOnly(-10), net: "412.00", vatAmount: "82.40", total: "494.40", notes: "Radiators and valves" },
    { tenantId, isDemo: true, supplier: "Plumb Center", category: "materials", spentOn: dateOnly(-3), net: "1640.00", vatAmount: "328.00", total: "1968.00", notes: "Boiler and filter", expectedOn: dateOnly(-1) },
    { tenantId, isDemo: true, supplier: "Shell", category: "fuel", spentOn: dateOnly(-2), net: "72.50", vatAmount: "14.50", total: "87.00" },
    { tenantId, isDemo: true, supplier: "Screwfix", category: "tools", spentOn: dateOnly(-8), net: "128.00", vatAmount: "25.60", total: "153.60", notes: "Press fit jaws" },
    { tenantId, isDemo: true, supplier: "Gas Safe Register", category: "insurance", spentOn: dateOnly(-30), net: "362.00", vatAmount: "0.00", total: "362.00", notes: "Annual registration" },
  ]);
  counts.expenses = 5;

  // ── Website enquiries, so the Messages tab is not a blank page ─────────────
  await db.insert(contactMessagesTable).values([
    {
      tenantId, isDemo: true, senderName: "Gemma Whitlock", senderEmail: "gemma.whitlock@example.com",
      senderPhone: "07700 900461", subject: "No hot water",
      message: "Hi, we've had no hot water since last night and the boiler is making a rattling noise. Are you able to come out today at all? Thanks.",
    },
    {
      tenantId, isDemo: true, senderName: "Owen Pryce", senderEmail: "owen.pryce@example.com",
      senderPhone: "07700 900712", subject: "Bathroom quote",
      message: "Looking to get the family bathroom done in the spring. Could you come and take a look and give me a price? Happy to send photos first if that's easier.",
    },
    {
      tenantId, isDemo: true, senderName: "Angela Moss", senderEmail: "angela.moss@example.com",
      senderPhone: "07700 900233", subject: "Thank you",
      message: "Just wanted to say thanks for sorting the radiators last week, house is warm again. Will be recommending you.",
    },
  ]);
  counts.messages = 3;

  logger.info({ tenantId, counts }, "Sample data seeded into tenant");
  return { seeded: true, counts };
}

/**
 * Take it all out again.
 *
 * Children first, because these rows are linked and Postgres will refuse a
 * parent delete otherwise. Every statement is scoped to the tenant AND to
 * `is_demo`, so the worst a bug here can do is leave sample data behind — it
 * cannot take a real customer with it.
 */
export async function removeTenantSampleData(tenantId: number): Promise<{ removed: number }> {
  const demoIds = async (table: any) =>
    (await db.select({ id: table.id }).from(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.isDemo, true))))
      .map((r: any) => r.id as number);

  const quoteIds = await demoIds(quotesTable);
  const jobIds = await demoIds(projectsTable);
  const invoiceIds = await demoIds(invoicesTable);

  if (quoteIds.length) await db.delete(quoteItemsTable).where(inArray(quoteItemsTable.quoteId, quoteIds));
  if (jobIds.length) {
    await db.delete(projectItemsTable).where(inArray(projectItemsTable.projectId, jobIds));
    await db.delete(projectUpdatesTable).where(inArray(projectUpdatesTable.projectId, jobIds));
  }
  if (invoiceIds.length) {
    await db.delete(invoiceItemsTable).where(inArray(invoiceItemsTable.invoiceId, invoiceIds));
    await db.delete(invoicePaymentsTable).where(inArray(invoicePaymentsTable.invoiceId, invoiceIds));
  }

  let removed = 0;
  // Order matters: invoices and certificates point at jobs, jobs point at
  // customers and quotes.
  for (const table of [
    invoicesTable, expensesTable, contactMessagesTable, propertiesTable,
    projectsTable, quotesTable, leadsTable, customersTable,
  ] as any[]) {
    const res: any = await db.delete(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.isDemo, true)));
    removed += Number(res?.rowCount ?? 0);
  }

  logger.info({ tenantId, removed }, "Sample data removed from tenant");
  return { removed };
}
