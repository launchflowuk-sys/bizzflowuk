/**
 * End-to-end check for the certificates engine, against a real API and database.
 *
 * Asserts behaviour, not HTTP status: that an incomplete record is refused, that
 * an issued one cannot be edited, that the PDF is real, and that a renewal
 * actually lands in the leads pipeline.
 *
 *   node scripts/e2e/certificates.mjs
 *
 * Env: API (default http://localhost:8080/api), EMAIL, PASSWORD, JOBS_SECRET.
 */

const API = process.env.API || "http://localhost:8080/api";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const JOBS_SECRET = process.env.JOBS_SECRET || "local-dev-jobs-secret";

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

let token = "";
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") || "";
  const payload = type.includes("json") ? await res.json().catch(() => null)
    : type.includes("pdf") ? Buffer.from(await res.arrayBuffer())
    : await res.text();
  return { status: res.status, body: payload };
}

const today = new Date().toISOString().slice(0, 10);
/** Expires inside the renewal window, so the sweep should pick it up. */
const almostAYearAgo = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 320);
  return d.toISOString().slice(0, 10);
})();

async function main() {
  console.log(`\ncertificates e2e — ${API}\n`);

  if (!EMAIL || !PASSWORD) {
    console.log("  EMAIL and PASSWORD are required (a tenant admin login).");
    process.exit(2);
  }

  const login = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.body?.token || "";
  check("login", login.status === 200 && !!token, `status ${login.status}`);
  if (!token) process.exit(1);

  const types = await api("GET", "/certificates/types");
  check("type registry lists gas_safety",
    Array.isArray(types.body) && types.body.some(t => t.key === "gas_safety"));
  check("gas_safety carries the 28-day delivery deadline",
    types.body?.find(t => t.key === "gas_safety")?.deliveryDeadlineDays === 28);

  // ── 1. Draft ──────────────────────────────────────────────────────────────
  const created = await api("POST", "/certificates", {
    type: "gas_safety",
    propertyAddress: "14 Test Road, Grays",
    propertyPostcode: "RM17 6TE",
    landlordName: "E2E Landlord",
    checkedAt: almostAYearAgo,
    engineerName: "E2E Engineer",
    engineerRegNo: "123456",
    appliances: [{ location: "Kitchen", applianceType: "Boiler", make: "Worcester", wasInspected: true }],
  });
  check("draft created", created.status === 201, `status ${created.status}`);
  const id = created.body?.id;
  check("reference issued in tenant format", /-GS-\d{4}$/.test(created.body?.reference || ""), created.body?.reference);
  check("expiry derived 12 months out",
    created.body?.expiresAt && created.body.expiresAt > almostAYearAgo, created.body?.expiresAt);
  check("appliance attached", created.body?.appliances?.length === 1);

  // ── 2. Incomplete record is refused ───────────────────────────────────────
  const tooEarly = await api("POST", `/certificates/${id}/issue`);
  check("issue refused while safeToUse is unanswered", tooEarly.status === 422,
    `status ${tooEarly.status}`);
  check("refusal explains why", Array.isArray(tooEarly.body?.problems) && tooEarly.body.problems.length > 0,
    JSON.stringify(tooEarly.body?.problems || []));

  // ── 3. Complete it, then issue ────────────────────────────────────────────
  await api("PATCH", `/certificates/${id}`, {
    appliances: [{
      location: "Kitchen", applianceType: "Boiler", make: "Worcester",
      wasInspected: true, flueFlowPass: true, safetyDevicesPass: true,
      ventilationPass: true, visualConditionPass: true, gasTightnessPass: true,
      safeToUse: true, operatingPressure: "20 mbar",
    }],
  });
  const issued = await api("POST", `/certificates/${id}/issue`);
  check("issued", issued.status === 200 && issued.body?.status === "issued", `status ${issued.status}`);
  check("pdf stored with a hash", !!issued.body?.pdfPath && /^[0-9a-f]{64}$/.test(issued.body?.pdfSha256 || ""));

  // ── 4. Immutability ───────────────────────────────────────────────────────
  const edit = await api("PATCH", `/certificates/${id}`, { propertyAddress: "Somewhere else" });
  check("issued certificate cannot be edited", edit.status === 409, `status ${edit.status}`);
  const del = await api("DELETE", `/certificates/${id}`);
  check("issued certificate cannot be deleted", del.status === 409, `status ${del.status}`);

  // ── 5. The PDF is a real PDF ──────────────────────────────────────────────
  const pdf = await api("GET", `/certificates/${id}/pdf`);
  const isPdf = Buffer.isBuffer(pdf.body) && pdf.body.subarray(0, 5).toString() === "%PDF-";
  check("pdf downloads and starts with %PDF-", isPdf, isPdf ? `${pdf.body.length} bytes` : `status ${pdf.status}`);
  check("pdf is not a stub", Buffer.isBuffer(pdf.body) && pdf.body.length > 1500, `${pdf.body?.length} bytes`);

  // ── 6. Supersede ──────────────────────────────────────────────────────────
  const superseded = await api("POST", `/certificates/${id}/supersede`, { checkedAt: today });
  check("supersede creates a new draft", superseded.status === 201 && superseded.body?.status === "draft");
  check("replacement copies the appliances", superseded.body?.appliances?.length === 1);
  const original = await api("GET", `/certificates/${id}`);
  check("original marked superseded and linked forward",
    original.body?.status === "superseded" && original.body?.supersededById === superseded.body?.id);

  // ── 7. Renewal sweep raises a lead ────────────────────────────────────────
  // The superseded original is excluded by design, so issue the replacement and
  // sweep on that.
  const rid = superseded.body.id;
  await api("PATCH", `/certificates/${rid}`, { checkedAt: almostAYearAgo });
  const reissued = await api("POST", `/certificates/${rid}/issue`);
  check("replacement issued", reissued.status === 200, `status ${reissued.status}`);

  const beforeLeads = await api("GET", "/leads");
  const beforeCount = Array.isArray(beforeLeads.body) ? beforeLeads.body.length : 0;

  const sweep = await fetch(`${API}/internal/jobs/certificate-renewals?windowDays=90`, {
    method: "POST", headers: { "x-jobs-secret": JOBS_SECRET },
  });
  const sweepBody = await sweep.json().catch(() => null);
  check("renewal sweep authorised and ran", sweep.status === 200, `status ${sweep.status}`);
  check("sweep raised at least one renewal", (sweepBody?.raised ?? 0) >= 1, JSON.stringify(sweepBody));

  const afterLeads = await api("GET", "/leads");
  const afterCount = Array.isArray(afterLeads.body) ? afterLeads.body.length : 0;
  check("renewal appears in the leads pipeline", afterCount > beforeCount, `${beforeCount} -> ${afterCount}`);

  const renewalLead = (afterLeads.body || []).find(l => l.source === "Renewal");
  check("renewal lead carries source 'Renewal'", !!renewalLead);
  check("renewal lead carries the property address",
    !!renewalLead && String(renewalLead.address || "").includes("Test Road"));

  // ── 8. Idempotency ────────────────────────────────────────────────────────
  const second = await fetch(`${API}/internal/jobs/certificate-renewals?windowDays=90`, {
    method: "POST", headers: { "x-jobs-secret": JOBS_SECRET },
  });
  const secondBody = await second.json().catch(() => null);
  check("re-running the sweep raises nothing new", (secondBody?.raised ?? -1) === 0, JSON.stringify(secondBody));

  // ── 9. The job endpoint is protected ──────────────────────────────────────
  const unauth = await fetch(`${API}/internal/jobs/certificate-renewals`, { method: "POST" });
  check("job endpoint rejects a caller with no secret", unauth.status === 404, `status ${unauth.status}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
