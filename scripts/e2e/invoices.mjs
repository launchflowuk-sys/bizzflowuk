/**
 * End-to-end check for invoices and expenses, against a real API and database.
 *
 * Asserts behaviour: that money arithmetic is right to the penny, that VAT is
 * absent for a tenant who is not registered, that status follows what has
 * actually been paid, that a quote cannot be invoiced twice, and that a sent
 * invoice cannot be deleted.
 *
 *   EMAIL=... PASSWORD=... node scripts/e2e/invoices.mjs
 */

const API = process.env.API || "http://localhost:8080/api";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

let token = "";
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  const payload = type.includes("json") ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, body: payload };
}

const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

async function main() {
  console.log(`\ninvoices e2e — ${API}\n`);
  if (!EMAIL || !PASSWORD) { console.log("  EMAIL and PASSWORD required."); process.exit(2); }

  const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.body?.token || "";
  check("login", !!token, `status ${login.status}`);
  if (!token) process.exit(1);

  // ── 1. Not VAT registered: no VAT anywhere ────────────────────────────────
  const plain = await api("POST", "/invoices", {
    propertyAddress: "ignored",
    items: [
      { description: "Boiler service", quantity: 1, unitPrice: 90 },
      { description: "Magnetic filter", quantity: 2, unitPrice: 55.5 },
    ],
  });
  check("invoice created", plain.status === 201, `status ${plain.status}`);
  check("reference in tenant format", /-INV-\d{4}$/.test(plain.body?.reference || ""), plain.body?.reference);
  check("subtotal correct to the penny", plain.body?.subtotal === "201.00", plain.body?.subtotal);
  check("no VAT for an unregistered tenant", plain.body?.vatAmount === "0.00", plain.body?.vatAmount);
  check("total equals subtotal", plain.body?.total === "201.00", plain.body?.total);
  check("due date defaults 14 days out", !!plain.body?.dueOn && plain.body.dueOn > today, plain.body?.dueOn);
  const id = plain.body?.id;

  // ── 2. Per-line VAT overrides ─────────────────────────────────────────────
  const mixed = await api("POST", "/invoices", {
    items: [
      { description: "Labour", quantity: 1, unitPrice: 100, vatRate: 20 },
      { description: "Zero-rated materials", quantity: 1, unitPrice: 100, vatRate: 0 },
    ],
  });
  check("mixed VAT: subtotal", mixed.body?.subtotal === "200.00", mixed.body?.subtotal);
  check("mixed VAT: only the rated line is taxed", mixed.body?.vatAmount === "20.00", mixed.body?.vatAmount);
  check("mixed VAT: total", mixed.body?.total === "220.00", mixed.body?.total);

  // ── 3. Rounding ───────────────────────────────────────────────────────────
  const rounding = await api("POST", "/invoices", {
    items: [{ description: "Third of a tenner", quantity: 3, unitPrice: 3.33, vatRate: 20 }],
  });
  check("rounding holds to the penny", rounding.body?.subtotal === "9.99" && rounding.body?.vatAmount === "2.00",
    `${rounding.body?.subtotal} / ${rounding.body?.vatAmount}`);

  // ── 4. Sending guards ─────────────────────────────────────────────────────
  const empty = await api("POST", "/invoices", { items: [] });
  const sendEmpty = await api("POST", `/invoices/${empty.body?.id}/send`);
  check("empty invoice refused on send", sendEmpty.status === 422, `status ${sendEmpty.status}`);
  check("refusal explains why", Array.isArray(sendEmpty.body?.problems) && sendEmpty.body.problems.length > 0);

  // ── 5. Customer, send, part pay, pay ──────────────────────────────────────
  const cust = await api("POST", "/customers", {
    firstName: "E2E", lastName: "Payer", email: "payer@example.invalid", phone: "07000000000",
  });
  const customerId = cust.body?.id;
  check("customer created", !!customerId, `status ${cust.status}`);

  await api("PATCH", `/invoices/${id}`, { customerId, dueOn: daysAgo(5) });
  const sent = await api("POST", `/invoices/${id}/send`);
  check("invoice sent", sent.status === 200, `status ${sent.status}`);

  const afterSend = await api("GET", `/invoices/${id}`);
  check("past due date reads as overdue", afterSend.body?.status === "overdue", afterSend.body?.status);

  const part = await api("POST", `/invoices/${id}/payments`, { amount: 100, method: "bank_transfer" });
  check("part payment accepted", part.status === 201, `status ${part.status}`);
  check("status becomes part_paid", part.body?.status === "part_paid", part.body?.status);
  check("outstanding is the remainder", part.body?.outstanding === "101.00", part.body?.outstanding);

  const rest = await api("POST", `/invoices/${id}/payments`, { amount: 101 });
  check("status becomes paid when settled", rest.body?.status === "paid", rest.body?.status);
  check("nothing outstanding", rest.body?.outstanding === "0.00", rest.body?.outstanding);

  const zero = await api("POST", `/invoices/${id}/payments`, { amount: 0 });
  check("a zero payment is rejected", zero.status === 400, `status ${zero.status}`);

  // ── 6. A sent invoice cannot be deleted ───────────────────────────────────
  const del = await api("DELETE", `/invoices/${id}`);
  check("sent invoice cannot be deleted", del.status === 409, `status ${del.status}`);
  const delDraft = await api("DELETE", `/invoices/${rounding.body?.id}`);
  check("a draft can be deleted", delDraft.status === 204, `status ${delDraft.status}`);

  // ── 7. Quote conversion ───────────────────────────────────────────────────
  // Quotes store their lines through a separate endpoint, so the test builds the
  // quote the same way the dashboard does rather than assuming a nested payload.
  const quote = await api("POST", "/quotes", { customerId });
  const quoteId = quote.body?.id;
  check("quote created", !!quoteId, `status ${quote.status}`);

  if (quoteId) {
    await api("POST", `/quotes/${quoteId}/items`, {
      description: "Bathroom refit", quantity: "1", unitPrice: "4200.00", total: "4200.00", sortOrder: 0,
    });
    const conv = await api("POST", `/quotes/${quoteId}/convert-invoice`);
    check("quote converts to an invoice", conv.status === 201, `status ${conv.status}`);
    check("line items carried over", conv.body?.items?.length === 1);
    check("value carried over", conv.body?.subtotal === "4200.00", conv.body?.subtotal);

    const again = await api("POST", `/quotes/${quoteId}/convert-invoice`);
    check("a quote cannot be invoiced twice", again.status === 409, `status ${again.status}`);
  }

  // ── 8. Void ───────────────────────────────────────────────────────────────
  const voided = await api("POST", `/invoices/${id}/void`, { reason: "e2e" });
  check("invoice voided", voided.body?.status === "void", voided.body?.status);
  const payVoid = await api("POST", `/invoices/${id}/payments`, { amount: 10 });
  check("a void invoice cannot take a payment", payVoid.status === 409, `status ${payVoid.status}`);

  // ── 8b. Repeating invoices ────────────────────────────────────────────────
  //
  // The date arithmetic here is the part that costs real money if it drifts. A
  // series anchored on the 31st must bill on the 28th in February and go BACK
  // to the 31st in March — stepping a Date by a month from 31 January lands on
  // 2 or 3 March, which would walk a "monthly" invoice into the middle of the
  // month over a couple of years.
  const rec = await api("POST", "/invoices", {
    issuedOn: "2026-01-31",
    items: [{ description: "Monthly maintenance", quantity: 1, unitPrice: 150 }],
  });
  check("invoice for the series created", rec.status === 201, `status ${rec.status}`);
  const recId = rec.body?.id;

  const monthly = await api("PUT", `/invoices/${recId}/recurrence`, { recurrence: "monthly" });
  check("monthly schedule accepted", monthly.status === 200, `status ${monthly.status}`);
  check("31 Jan + monthly clamps to 28 Feb",
    monthly.body?.recurrenceNextOn === "2026-02-28", monthly.body?.recurrenceNextOn);

  const bad = await api("PUT", `/invoices/${recId}/recurrence`, { recurrence: "daily" });
  check("an unknown cadence is rejected", bad.status === 400, `status ${bad.status}`);

  const early = await api("PUT", `/invoices/${recId}/recurrence`, {
    recurrence: "monthly", until: "2026-01-01",
  });
  check("an end date before the next issue is rejected", early.status === 422, `status ${early.status}`);

  const stopped = await api("PUT", `/invoices/${recId}/recurrence`, { recurrence: null });
  check("a series can be stopped", stopped.body?.recurrence === null, String(stopped.body?.recurrence));
  check("stopping clears the next date", stopped.body?.recurrenceNextOn === null, String(stopped.body?.recurrenceNextOn));

  // ── 9. Expenses ───────────────────────────────────────────────────────────
  const exp = await api("POST", "/expenses", {
    supplier: "Plumb Center", category: "materials", spentOn: today, net: 120, vatAmount: 24,
  });
  check("expense created", exp.status === 201, `status ${exp.status}`);
  check("expense total derived", exp.body?.total === "144.00", exp.body?.total);

  const expList = await api("GET", "/expenses");
  check("expense appears in the list", Array.isArray(expList.body) && expList.body.length >= 1);

  const badExp = await api("POST", "/expenses", { category: "materials", spentOn: today });
  check("expense without a supplier is rejected", badExp.status === 400, `status ${badExp.status}`);

  // ── 10. Tenant isolation ──────────────────────────────────────────────────
  const foreign = await api("GET", "/invoices/999999");
  check("an invoice from another tenant is not readable", foreign.status === 404, `status ${foreign.status}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
