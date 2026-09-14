/**
 * End-to-end check for the automations engine.
 *
 * Asserts the two rules that matter: nothing runs until a tenant enables it, and
 * a rule never acts on the same subject twice.
 *
 *   EMAIL=... PASSWORD=... node scripts/e2e/automations.mjs
 */

const API = process.env.API || "http://localhost:8080/api";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const JOBS_SECRET = process.env.JOBS_SECRET || "local-dev-jobs-secret";

let pass = 0, fail = 0;
const check = (n, ok, d) => ok
  ? (pass++, console.log(`  ok    ${n}`))
  : (fail++, console.log(`  FAIL  ${n}${d ? ` — ${d}` : ""}`));

let token = "";
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = res.headers.get("content-type") || "";
  return { status: res.status, body: t.includes("json") ? await res.json().catch(() => null) : await res.text() };
}

const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

async function main() {
  console.log(`\nautomations e2e — ${API}\n`);
  if (!EMAIL || !PASSWORD) { console.log("  EMAIL and PASSWORD required."); process.exit(2); }

  const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.body?.token || "";
  check("login", !!token, `status ${login.status}`);
  if (!token) process.exit(1);

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const cat = await api("GET", "/automations");
  check("catalogue lists rules", Array.isArray(cat.body?.rules) && cat.body.rules.length >= 3, `${cat.body?.rules?.length}`);
  check("everything is off by default", cat.body?.rules?.every(r => r.enabled === false));
  check("counter starts from real data", typeof cat.body?.actionsThisMonth === "number");

  const chase = cat.body?.rules?.find(r => r.key === "chase_unpaid_invoices");
  check("chase rule has sensible defaults", JSON.stringify(chase?.defaults?.days) === "[3,7,14]", JSON.stringify(chase?.defaults));
  check("chase rule ships setup questions", Array.isArray(chase?.setup) && chase.setup.length > 0);

  // ── An overdue invoice, with the rule OFF ─────────────────────────────────
  const cust = await api("POST", "/customers", {
    firstName: "Auto", lastName: "Test", email: "auto@example.invalid", phone: "07000000001",
  });
  const inv = await api("POST", "/invoices", {
    customerId: cust.body?.id,
    dueOn: daysAgo(20),
    items: [{ description: "Overdue job", quantity: 1, unitPrice: 250 }],
  });
  await api("POST", `/invoices/${inv.body?.id}/send`);
  check("invoice is overdue", (await api("GET", `/invoices/${inv.body?.id}`)).body?.status === "overdue");

  const offRun = await api("POST", "/automations/run");
  check("a disabled rule does nothing", offRun.body?.actions === 0, JSON.stringify(offRun.body));

  // ── Invalid config is refused ─────────────────────────────────────────────
  const bad = await api("PATCH", "/automations/chase_unpaid_invoices", { enabled: true, config: { days: "soon" } });
  check("invalid settings are refused", bad.status === 400, `status ${bad.status}`);

  const unknown = await api("PATCH", "/automations/not_a_rule", { enabled: true });
  check("an unknown rule is refused", unknown.status === 404, `status ${unknown.status}`);

  // ── Enable, then run ──────────────────────────────────────────────────────
  const on = await api("PATCH", "/automations/chase_unpaid_invoices", { enabled: true, config: { days: [3, 7, 14] } });
  check("rule enabled", on.status === 200 && on.body?.enabled === true, `status ${on.status}`);

  const run1 = await api("POST", "/automations/run");
  check("enabled rule chases the overdue invoice", run1.body?.actions >= 1, JSON.stringify(run1.body));

  const run2 = await api("POST", "/automations/run");
  check("re-running does not chase again", run2.body?.actions === 0, JSON.stringify(run2.body));

  // ── Activity and the counter ──────────────────────────────────────────────
  const activity = await api("GET", "/automations/activity");
  check("the action is recorded", Array.isArray(activity.body) && activity.body.length >= 1);
  check("the record says what it did",
    typeof activity.body?.[0]?.summary === "string" && activity.body[0].summary.includes("Chased"),
    activity.body?.[0]?.summary);

  const after = await api("GET", "/automations");
  check("counter reflects real actions", (after.body?.actionsThisMonth ?? 0) >= 1, `${after.body?.actionsThisMonth}`);
  check("set-up count is right", after.body?.setUpCount === 1, `${after.body?.setUpCount}`);

  // ── The daily job endpoint ────────────────────────────────────────────────
  const unauth = await fetch(`${API}/internal/jobs/automations-daily`, { method: "POST" });
  check("daily job rejects a caller with no secret", unauth.status === 404, `status ${unauth.status}`);

  const daily = await fetch(`${API}/internal/jobs/automations-daily`, {
    method: "POST", headers: { "x-jobs-secret": JOBS_SECRET },
  });
  const dailyBody = await daily.json().catch(() => null);
  check("daily job runs across tenants", daily.status === 200 && typeof dailyBody?.tenants === "number", JSON.stringify(dailyBody));

  // Tidy up so re-running the suite starts clean.
  await api("PATCH", "/automations/chase_unpaid_invoices", { enabled: false });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
