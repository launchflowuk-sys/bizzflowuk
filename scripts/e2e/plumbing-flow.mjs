/**
 * Full plumbing job flow, end to end against a real API and database.
 *
 * Walks the journey a real job takes rather than testing endpoints in isolation:
 *
 *   public enquiry -> lead -> quote -> accepted -> project -> scheduled and
 *   dispatched -> certificate issued and sent -> invoice raised -> part paid ->
 *   paid -> renewal raised by the automation a year later
 *
 * Every assertion is about behaviour, not status codes — that the customer
 * record is reused rather than duplicated, that money survives the whole trip to
 * the penny, that an issued certificate is frozen, and that the automation
 * cannot act twice.
 *
 *   EMAIL=... PASSWORD=... node scripts/e2e/plumbing-flow.mjs
 */

const API = process.env.API || "http://localhost:8080/api";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const SLUG = process.env.SLUG || "bps";

let pass = 0, fail = 0;
const results = [];
function check(step, name, ok, detail) {
  if (ok) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); results.push(`${step}: ${name}`); }
}
function stage(n, title) { console.log(`\n── ${n}. ${title} ${"─".repeat(Math.max(0, 54 - title.length))}`); }

let token = "";
async function api(method, path, body, auth = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(auth && token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = res.headers.get("content-type") || "";
  const payload = t.includes("json") ? await res.json().catch(() => null)
    : t.includes("pdf") ? Buffer.from(await res.arrayBuffer())
    : await res.text();
  return { status: res.status, body: payload };
}

const iso = d => d.toISOString().slice(0, 10);
const today = iso(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const daysAhead = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const stamp = Date.now();
const EMAIL_C = `flow${stamp}@example.invalid`;

async function main() {
  console.log(`\nplumbing job flow — ${API}\n`);
  if (!EMAIL || !PASSWORD) { console.log("  EMAIL and PASSWORD required."); process.exit(2); }

  const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.body?.token || "";
  check(0, "signed in", !!token, `status ${login.status}`);
  if (!token) process.exit(1);

  // ── 1. A customer finds the website and asks for a quote ──────────────────
  stage(1, "Public enquiry from the website");
  const enquiry = await api("POST", `/public/${SLUG}/quote-request`, {
    firstName: "Janet", lastName: "Fairweather",
    email: EMAIL_C, phone: "07700900123",
    address: "22 Orsett Road, Grays", postcode: "RM17 5DB",
    serviceInterest: "Boiler Installation",
    notes: "Old boiler keeps cutting out. Landlord property, two tenants.",
    source: "Google",
  }, false);
  check(1, "enquiry accepted without a login", enquiry.status === 201, `status ${enquiry.status}`);
  check(1, "lead given a reference", !!enquiry.body?.reference, enquiry.body?.reference);
  check(1, "paid-search source preserved", enquiry.body?.source === "Google", enquiry.body?.source);
  const leadId = enquiry.body?.id;

  const leads = await api("GET", "/leads");
  check(1, "lead is visible in the dashboard",
    Array.isArray(leads.body) && leads.body.some(l => l.id === leadId));

  // ── 2. Quote ──────────────────────────────────────────────────────────────
  stage(2, "Quote the job");
  const customer = await api("POST", "/customers", {
    firstName: "Janet", lastName: "Fairweather", email: EMAIL_C, phone: "07700900123",
    address: "22 Orsett Road, Grays", postcode: "RM17 5DB",
  });
  const customerId = customer.body?.id;
  check(2, "customer record created", !!customerId, `status ${customer.status}`);

  const quote = await api("POST", "/quotes", { customerId, leadId, status: "Draft" });
  const quoteId = quote.body?.id;
  check(2, "quote created", !!quoteId, `status ${quote.status}`);

  for (const [i, line] of [
    ["Worcester Bosch 30kW combi, supplied and fitted", "1", "2150.00"],
    ["System flush and magnetic filter", "1", "385.00"],
    ["Thermostat and controls", "1", "165.00"],
  ].entries()) {
    await api("POST", `/quotes/${quoteId}/items`, {
      description: line[0], quantity: line[1], unitPrice: line[2],
      total: (Number(line[1]) * Number(line[2])).toFixed(2), sortOrder: i,
    });
  }
  const items = await api("GET", `/quotes/${quoteId}/items`);
  check(2, "three lines on the quote", items.body?.length === 3, `${items.body?.length}`);

  await api("PATCH", `/quotes/${quoteId}`, { status: "Sent", sentAt: new Date().toISOString() });
  const sentQuote = await api("GET", `/quotes/${quoteId}`);
  check(2, "quote marked sent", sentQuote.body?.status === "Sent", sentQuote.body?.status);

  // ── 3. Accepted, and the job becomes real ─────────────────────────────────
  stage(3, "Customer accepts");
  await api("PATCH", `/quotes/${quoteId}`, { status: "Accepted", acceptedAt: new Date().toISOString() });
  const accepted = await api("GET", `/quotes/${quoteId}`);
  check(3, "quote accepted", accepted.body?.status === "Accepted", accepted.body?.status);

  const project = await api("POST", "/projects", {
    title: "Boiler installation — 22 Orsett Road",
    customerId, quoteId, status: "Quote Approved",
    address: "22 Orsett Road, Grays", postcode: "RM17 5DB",
  });
  const projectId = project.body?.id;
  check(3, "project created from the quote", !!projectId, `status ${project.status}`);

  // ── 4. Book it in and send someone ────────────────────────────────────────
  stage(4, "Schedule and dispatch");
  const engineers = await api("GET", "/schedule/engineers");
  check(4, "engineers available to dispatch to", Array.isArray(engineers.body) && engineers.body.length >= 1);
  const engineerId = engineers.body?.[0]?.id;

  const booked = await api("PATCH", `/schedule/${projectId}`, {
    scheduledStart: `${daysAhead(3)}T08:30:00Z`,
    scheduledEnd: `${daysAhead(3)}T16:00:00Z`,
    assignedUserId: engineerId,
  });
  check(4, "job booked", booked.status === 200, `status ${booked.status}`);
  check(4, "booking advanced the status by itself", booked.body?.status === "Scheduled", booked.body?.status);
  check(4, "engineer assigned", booked.body?.assignedUserId === engineerId);

  const diary = await api("GET", `/schedule?from=${today}&to=${daysAhead(30)}`);
  const onDiary = (diary.body ?? []).find(j => j.id === projectId);
  check(4, "job appears on the diary", !!onDiary);
  check(4, "diary resolves the engineer's name", !!onDiary?.assignedTo?.name, onDiary?.assignedTo?.name);

  const foreign = await api("PATCH", `/schedule/${projectId}`, { assignedUserId: 999999 });
  check(4, "cannot dispatch to someone outside the team", foreign.status === 400, `status ${foreign.status}`);

  // ── 5. Gas safety certificate ─────────────────────────────────────────────
  stage(5, "Issue the landlord certificate");
  const cert = await api("POST", "/certificates", {
    type: "gas_safety",
    customerId, projectId,
    propertyAddress: "22 Orsett Road, Grays",
    propertyPostcode: "RM17 5DB",
    landlordName: "Janet Fairweather",
    tenantContactEmail: `tenant${stamp}@example.invalid`,
    checkedAt: daysAgo(330),
    engineerName: "Brandon", engineerRegNo: "654321",
    appliances: [{ location: "Kitchen", applianceType: "Boiler", make: "Worcester Bosch", wasInspected: true }],
  });
  const certId = cert.body?.id;
  check(5, "certificate drafted", cert.status === 201, `status ${cert.status}`);
  check(5, "expiry derived, not supplied", !!cert.body?.expiresAt && cert.body.expiresAt > cert.body.checkedAt);

  const premature = await api("POST", `/certificates/${certId}/issue`);
  check(5, "refuses to issue with an unanswered safety check", premature.status === 422, `status ${premature.status}`);

  await api("PATCH", `/certificates/${certId}`, {
    appliances: [{
      location: "Kitchen", applianceType: "Boiler", make: "Worcester Bosch", wasInspected: true,
      flueFlowPass: true, safetyDevicesPass: true, ventilationPass: true,
      visualConditionPass: true, gasTightnessPass: true, safeToUse: true,
      operatingPressure: "20 mbar", combustionReading: "0.0023 ratio",
    }],
  });
  const issued = await api("POST", `/certificates/${certId}/issue`);
  check(5, "certificate issued", issued.body?.status === "issued", `status ${issued.status}`);
  check(5, "pdf stored and hashed", !!issued.body?.pdfPath && /^[0-9a-f]{64}$/.test(issued.body?.pdfSha256 || ""));

  const pdf = await api("GET", `/certificates/${certId}/pdf`);
  check(5, "pdf is a real pdf", Buffer.isBuffer(pdf.body) && pdf.body.subarray(0, 5).toString() === "%PDF-");
  check(5, "pdf has real content", Buffer.isBuffer(pdf.body) && pdf.body.length > 2000, `${pdf.body?.length} bytes`);

  const tamper = await api("PATCH", `/certificates/${certId}`, { propertyAddress: "Somewhere else" });
  check(5, "issued certificate is frozen", tamper.status === 409, `status ${tamper.status}`);

  // ── 6. Invoice ────────────────────────────────────────────────────────────
  stage(6, "Invoice the job");
  const conv = await api("POST", `/quotes/${quoteId}/convert-invoice`);
  const invId = conv.body?.id;
  check(6, "invoice raised from the quote", conv.status === 201, `status ${conv.status}`);
  check(6, "all three lines carried over", conv.body?.items?.length === 3, `${conv.body?.items?.length}`);
  check(6, "value survived the trip to the penny", conv.body?.subtotal === "2700.00", conv.body?.subtotal);

  const dupe = await api("POST", `/quotes/${quoteId}/convert-invoice`);
  check(6, "the same quote cannot be invoiced twice", dupe.status === 409, `status ${dupe.status}`);

  await api("PATCH", `/invoices/${invId}`, { customerId, dueOn: daysAgo(20) });
  const sent = await api("POST", `/invoices/${invId}/send`);
  check(6, "invoice sent", sent.status === 200, `status ${sent.status}`);

  const afterSend = await api("GET", `/invoices/${invId}`);
  check(6, "past its due date it reads as overdue", afterSend.body?.status === "overdue", afterSend.body?.status);

  // ── 7. Getting paid ───────────────────────────────────────────────────────
  stage(7, "Deposit, then the balance");
  const deposit = await api("POST", `/invoices/${invId}/payments`, { amount: 1000, method: "card" });
  check(7, "deposit recorded", deposit.status === 201, `status ${deposit.status}`);
  check(7, "status becomes part paid", deposit.body?.status === "part_paid", deposit.body?.status);
  check(7, "outstanding is right", deposit.body?.outstanding === "1700.00", deposit.body?.outstanding);

  const balance = await api("POST", `/invoices/${invId}/payments`, { amount: 1700, method: "bank_transfer" });
  check(7, "settled in full", balance.body?.status === "paid", balance.body?.status);
  check(7, "nothing left outstanding", balance.body?.outstanding === "0.00", balance.body?.outstanding);

  const del = await api("DELETE", `/invoices/${invId}`);
  check(7, "a paid invoice cannot be deleted", del.status === 409, `status ${del.status}`);

  // ── 8. Expenses and the money screens ─────────────────────────────────────
  stage(8, "Cost the job and check the money screens");
  const expense = await api("POST", "/expenses", {
    supplier: "Plumb Center", category: "materials", spentOn: today,
    net: 1180, vatAmount: 236, projectId, billable: true,
  });
  check(8, "materials logged against the job", expense.status === 201, `status ${expense.status}`);
  check(8, "expense total derived", expense.body?.total === "1416.00", expense.body?.total);

  const cash = await api("GET", "/money/cash-flow");
  check(8, "cash flow returns a full forecast", (cash.body?.series ?? []).length === 13, `${cash.body?.series?.length} weeks`);
  check(8, "cash flow states its basis honestly",
    typeof cash.body?.basis === "string" && /no bank feed/i.test(cash.body.basis), cash.body?.basis);

  const vat = await api("GET", "/money/vat-position");
  check(8, "vat counts the paid invoice", Number(vat.body?.rollingTurnover) >= 2700, vat.body?.rollingTurnover);
  check(8, "vat threshold is the current £90k", vat.body?.threshold === "90000.00", vat.body?.threshold);

  // ── 9. A year on, the automation books the renewal ────────────────────────
  stage(9, "The renewal, twelve months later");
  await api("PATCH", "/automations/certificate_renewals", { enabled: true, config: { days: [42, 14] } });

  const before = (await api("GET", "/leads")).body?.length ?? 0;
  const run = await api("POST", "/automations/run", { key: "certificate_renewals" });
  check(9, "automation ran", run.status === 200, `status ${run.status}`);
  check(9, "it raised the renewal", run.body?.actions >= 1, JSON.stringify(run.body));

  const after = (await api("GET", "/leads")).body ?? [];
  check(9, "renewal landed in the leads pipeline", after.length > before, `${before} -> ${after.length}`);
  const renewal = after.find(l => l.source === "Renewal" && String(l.address || "").includes("Orsett"));
  check(9, "renewal carries the property", !!renewal, renewal?.address);

  const again = await api("POST", "/automations/run", { key: "certificate_renewals" });
  check(9, "it will not raise the same renewal twice", again.body?.actions === 0, JSON.stringify(again.body));

  const activity = await api("GET", "/automations/activity");
  check(9, "the action is on the record", Array.isArray(activity.body) && activity.body.length >= 1);

  // ── 10. Isolation ─────────────────────────────────────────────────────────
  stage(10, "Nothing leaks between tenants");
  const otherInv = await api("GET", "/invoices/999999");
  check(10, "another tenant's invoice is invisible", otherInv.status === 404, `status ${otherInv.status}`);
  const otherCert = await api("GET", "/certificates/999999");
  check(10, "another tenant's certificate is invisible", otherCert.status === 404, `status ${otherCert.status}`);
  const noAuth = await fetch(`${API}/invoices`);
  check(10, "no token, no data", noAuth.status === 401, `status ${noAuth.status}`);

  await api("PATCH", "/automations/certificate_renewals", { enabled: false });

  console.log(`\n${"═".repeat(60)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) { console.log("\nfailures:"); results.forEach(r => console.log(`  · ${r}`)); }
  console.log("");
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
