import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { buildSmtpConfig } from "../lib/settingsHelpers";

/** All Help Centre support requests land here, tagged with tenant + user + urgency. */
const SUPPORT_EMAIL = "support@launchflow.co.uk";
const URGENCIES = ["Low", "Normal", "High", "Urgent"] as const;

const router = Router();

/**
 * POST /support-request — sends a support request from the dashboard Help Centre to LaunchFlow.
 * Uses the tenant's own SMTP (the same config all their notifications use); if that isn't set up
 * yet, fails with a clear message telling them to email support directly instead of a silent drop.
 */
router.post("/support-request", requireTenantAccess, async (req, res) => {
  try {
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const urgency = URGENCIES.includes(req.body?.urgency) ? req.body.urgency : "Normal";
    const page = typeof req.body?.page === "string" ? req.body.page.trim() : "";
    if (!subject || !message) { res.status(400).json({ error: "subject and message are required" }); return; }

    const tenantId = req.authUser?.tenantId ?? -1;
    const tenantRows = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
    const smtp = buildSmtpConfig(settingsRows[0] as any);
    if (!smtp) {
      res.status(400).json({ error: `Email isn't configured for your account yet — please email ${SUPPORT_EMAIL} directly.` });
      return;
    }

    const tenantName = tenantRows[0]?.name ?? `Tenant #${tenantId}`;
    const fromUser = req.authUser?.email ?? "unknown user";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = [
      `<h2 style="margin:0 0 12px">Support request</h2>`,
      `<table cellpadding="6" style="border-collapse:collapse;font-size:14px">`,
      `<tr><td style="color:#64748b">Business</td><td><strong>${esc(tenantName)}</strong></td></tr>`,
      `<tr><td style="color:#64748b">From</td><td>${esc(fromUser)}</td></tr>`,
      `<tr><td style="color:#64748b">Urgency</td><td><strong>${urgency}</strong></td></tr>`,
      page ? `<tr><td style="color:#64748b">Relates to</td><td>${esc(page)}</td></tr>` : "",
      `</table>`,
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">`,
      `<p style="white-space:pre-wrap;font-size:14px">${esc(message)}</p>`,
    ].join("");

    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[${urgency}] [${tenantName}] ${subject}`,
      html,
      text: `Support request from ${tenantName} (${fromUser})\nUrgency: ${urgency}${page ? `\nRelates to: ${page}` : ""}\n\n${message}`,
    }, smtp);

    res.status(201).json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
