/**
 * End-to-end walk of the booking funnel for one tenant.
 * Every step hits the real API; every email is asserted against a real SMTP server.
 * See ./README.md for the two commands that set up the rig.
 */
const API   = process.env.E2E_API   || "http://localhost:8080/api";
const MAIL  = process.env.E2E_MAIL  || "http://localhost:8025/api/v1";
const SLUG  = process.env.E2E_SLUG  || "amo-rendering";
const ADMIN = {
  email:    process.env.E2E_ADMIN_EMAIL || "mark@amorendering.co.uk",
  password: process.env.E2E_ADMIN_PASS  || "LocalTest123!",
};
const ADMIN_INBOX = ADMIN.email;

const results = [];
let token = null;

const j = (r) => r.json();
async function call(method, path, body, auth = true) {
  const headers = { "content-type": "application/json" };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function mailReset() { await fetch(`${MAIL}/messages`, { method: "DELETE" }); }
async function mailbox() {
  const d = await j(await fetch(`${MAIL}/messages?limit=50`));
  return (d.messages || []).map((m) => ({
    to: m.To.map((t) => t.Address).join(","),
    subject: m.Subject,
  }));
}

function record(step, pass, detail) {
  results.push({ step, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
}

const run = async () => {
  // ── 1. Public enquiry ─────────────────────────────────────────────────────
  await mailReset();
  const lead = await call("POST", `/public/${SLUG}/quote-request`, {
    firstName: "E2E", lastName: "Tester",
    email: "customer@example.com", phone: "07700900123",
    serviceInterest: "Silicone Render",
    address: "1 Test Road", postcode: "RM17 6XX",
    propertyType: "Semi-detached", timeframe: "1-3 months",
    notes: "End-to-end verification run",
  }, false);
  record("1. Public quote-request accepted", lead.status === 200 || lead.status === 201, `HTTP ${lead.status}`);
  await sleep(2500);
  let mail = await mailbox();
  record("1a. Admin alerted to new lead", mail.some((m) => m.to.includes(ADMIN_INBOX)),
    mail.filter((m) => m.to.includes(ADMIN_INBOX)).map((m) => m.subject).join(" | ") || "NO ADMIN EMAIL");
  record("1b. Customer acknowledgement sent", mail.some((m) => m.to.includes("customer@example.com")),
    mail.filter((m) => m.to.includes("customer@")).map((m) => m.subject).join(" | ") || "NO CUSTOMER EMAIL");

  // ── 2. Admin login ────────────────────────────────────────────────────────
  const login = await call("POST", "/auth/login", ADMIN, false);
  token = login.body?.token;
  record("2. Admin login", !!token, `HTTP ${login.status}`);
  if (!token) return finish();

  // ── 3. Lead visible in dashboard ──────────────────────────────────────────
  const leads = await call("GET", "/leads");
  const mine = Array.isArray(leads.body) ? leads.body.find((l) => l.email === "customer@example.com") : null;
  record("3. Lead appears in dashboard", !!mine, mine ? `lead #${mine.id}, status ${mine.status}` : "not found");
  if (!mine) return finish();

  // ── 4. Book survey ────────────────────────────────────────────────────────
  await mailReset();
  const survey = await call("POST", `/leads/${mine.id}/survey`, {
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    notes: "E2E survey",
  });
  record("4. Survey booked", survey.status < 300, `HTTP ${survey.status}`);
  await sleep(2500);
  mail = await mailbox();
  record("4a. Customer told survey is booked", mail.some((m) => m.to.includes("customer@example.com")),
    mail.map((m) => m.subject).join(" | ") || "NO EMAIL");
  record("4b. Admin gets survey confirmation", mail.some((m) => m.to.includes(ADMIN_INBOX)),
    mail.filter((m) => m.to.includes(ADMIN_INBOX)).map((m) => m.subject).join(" | ") || "NO ADMIN EMAIL");

  // ── 5. Convert lead → quote ───────────────────────────────────────────────
  const conv = await call("POST", `/leads/${mine.id}/convert-quote`, {});
  const quote = conv.body;
  record("5. Lead converted to quote", conv.status < 300 && !!quote?.id,
    quote?.id ? `quote #${quote.id} ${quote.reference}` : `HTTP ${conv.status}`);
  if (!quote?.id) return finish();

  // ── 6. Add a line item + total ────────────────────────────────────────────
  const item = await call("POST", `/quotes/${quote.id}/items`, {
    description: "Silicone render — 3-bed semi", quantity: "1", unitPrice: "4800.00", total: "4800.00", sortOrder: 1,
  });
  record("6. Quote line item added", item.status < 300, `HTTP ${item.status}`);
  const upd = await call("PATCH", `/quotes/${quote.id}`, { total: "4800.00", subtotal: "4800.00" });
  record("6a. Quote total set", upd.status < 300, `HTTP ${upd.status}`);

  // ── 7. Payment link ───────────────────────────────────────────────────────
  const link = await call("POST", `/quotes/${quote.id}/payment-links`, { amount: "1200.00" });
  record("7. Payment link created", link.status < 300 && !!link.body?.id,
    link.body?.id ? `link #${link.body.id}` : `HTTP ${link.status} ${JSON.stringify(link.body).slice(0, 120)}`);
  if (!link.body?.id) return finish();

  // ── 8. THE REPORTED BUG: send the quote ───────────────────────────────────
  await mailReset();
  const send = await call("POST", `/payment-links/${link.body.id}/send`, {});
  record("8. Quote sent to customer", send.status < 300, `HTTP ${send.status}`);
  await sleep(2500);
  mail = await mailbox();
  record("8a. Customer receives the quote", mail.some((m) => m.to.includes("customer@example.com")),
    mail.filter((m) => m.to.includes("customer@")).map((m) => m.subject).join(" | ") || "NO CUSTOMER EMAIL");
  record("8b. ADMIN receives confirmation quote was sent", mail.some((m) => m.to.includes(ADMIN_INBOX)),
    mail.filter((m) => m.to.includes(ADMIN_INBOX)).map((m) => m.subject).join(" | ") || "NO ADMIN EMAIL  <-- reported issue");

  // ── 9. Customer opens the pay page ────────────────────────────────────────
  const payToken = send.body?.token || link.body?.token;
  const payPage = await call("GET", `/public/pay/${payToken}`, null, false);
  record("9. Customer pay page loads", payPage.status === 200,
    `HTTP ${payPage.status}${payPage.body?.quote ? ` — ${payPage.body.quote.reference}` : ""}`);

  // ── 10. Customer accepts the quote ────────────────────────────────────────
  await mailReset();
  const accept = await call("POST", `/public/pay/${payToken}/action`, { action: "accept" }, false);
  record("10. Customer accepts quote", accept.status < 300, `HTTP ${accept.status}`);
  await sleep(2500);
  mail = await mailbox();
  record("10a. Admin alerted quote was accepted", mail.some((m) => m.to.includes(ADMIN_INBOX)),
    mail.filter((m) => m.to.includes(ADMIN_INBOX)).map((m) => m.subject).join(" | ") || "NO ADMIN EMAIL");

  // ── 11. Customer auto-created ─────────────────────────────────────────────
  const customers = await call("GET", "/customers");
  const cust = Array.isArray(customers.body) ? customers.body.find((c) => c.email === "customer@example.com") : null;
  record("11. Customer record auto-created", !!cust, cust ? `customer #${cust.id}` : "not created");

  // ── 12. Contact form ──────────────────────────────────────────────────────
  await mailReset();
  const contact = await call("POST", `/public/${SLUG}/contact`, {
    senderName: "E2E Contact", senderEmail: "enquirer@example.com", senderPhone: "07700900999",
    subject: "E2E", message: "Testing the contact form end to end.",
  }, false);
  record("12. Contact form accepted", contact.status < 300, `HTTP ${contact.status}`);
  await sleep(2500);
  mail = await mailbox();
  record("12a. Admin receives contact message", mail.some((m) => m.to.includes(ADMIN_INBOX)),
    mail.filter((m) => m.to.includes(ADMIN_INBOX)).map((m) => m.subject).join(" | ") || "NO ADMIN EMAIL");

  finish();
};

function finish() {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${"=".repeat(60)}\n${pass}/${results.length} passed\n${"=".repeat(60)}`);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("FAILURES:");
    for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
    process.exitCode = 1;
  }
}

run().catch((e) => { console.error("HARNESS ERROR", e); finish(); });
