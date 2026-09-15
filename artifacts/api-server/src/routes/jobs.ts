import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { sweepRenewals } from "../lib/certificates/renewals";
import { resetDemoWorkspace } from "../lib/demo/reset";
import { runAutomationsForAllTenants } from "./automations";
import { sweepRecurringInvoices } from "../lib/invoices/recurring";

const router = Router();

/**
 * Internal job endpoints, called on a schedule from outside the app.
 *
 * An endpoint rather than an in-process scheduler: it is re-runnable by hand
 * while debugging, it survives a container restart, and it does not add a
 * scheduler dependency. Coolify calls it daily.
 */

/** Constant-time compare so the secret can't be probed a character at a time. */
function secretOk(provided: string | undefined): boolean {
  const expected = process.env["JOBS_SECRET"];
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

router.post("/internal/jobs/certificate-renewals", async (req: any, res) => {
  if (!secretOk(req.get("x-jobs-secret"))) {
    // Deliberately terse: an unauthenticated caller learns nothing about
    // whether the job exists or the secret is merely unset.
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const windowDays = Number(req.query.windowDays) || undefined;
    const result = await sweepRenewals({ windowDays });
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * The daily sweep for every tenant's enabled automations.
 *
 * Supersedes the standalone certificate-renewal endpoint, which stays in place so
 * an existing Coolify schedule does not silently stop working.
 */
router.post("/internal/jobs/automations-daily", async (req: any, res) => {
  if (!secretOk(req.get("x-jobs-secret"))) { res.status(404).json({ error: "Not found" }); return; }
  try {
    const result = await runAutomationsForAllTenants();
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * Issue the invoices that fell due today on every repeating series.
 *
 * Separate from automations-daily on purpose: this creates money documents, so
 * when something goes wrong it needs to be obvious which sweep did it and
 * re-runnable on its own. Catching up is safe -- a copy already issued for a
 * date has already advanced that series past it.
 */
router.post("/internal/jobs/recurring-invoices", async (req: any, res) => {
  if (!secretOk(req.get("x-jobs-secret"))) { res.status(404).json({ error: "Not found" }); return; }
  try {
    const result = await sweepRecurringInvoices();
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Put the public demo workspace back how it was, on demand.
 *
 * The scheduler does this daily in-process; this is the way to do it now —
 * after someone has left the demo in a state worth clearing, or to prove the
 * reset works without waiting a day for it.
 *
 * Behind the same shared secret as the other internal jobs, and it can only
 * ever touch the tenant whose slug AND plan are both `demo`.
 */
router.post("/internal/jobs/reset-demo", async (req: any, res) => {
  if (!secretOk(req.get("x-jobs-secret"))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const result = await resetDemoWorkspace("manual trigger");
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error(err, "Manual demo reset failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
