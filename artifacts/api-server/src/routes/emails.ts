import { Router } from "express";
import { db } from "@workspace/db";
import { sentEmailsTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { sendEmail, buildComposedEmail } from "../lib/email";
import { buildSmtpConfig, buildBrandConfig } from "../lib/settingsHelpers";

const router = Router();

router.get("/emails", requireTenantAccess, async (req, res) => {
  try {
    const rows = await db.select().from(sentEmailsTable)
      .where(tenantFilter(req, sentEmailsTable.tenantId))
      .orderBy(sql`${sentEmailsTable.createdAt} desc`);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Sends a Mark-composed email through the same branded shell as the automated notifications,
// then logs it (outbound only — this is not a synced inbox, per the scoped-down request).
router.post("/emails/compose", requireTenantAccess, async (req, res) => {
  try {
    const { toEmail, toName, subject, bodyHtml, leadId } = req.body;
    if (!toEmail || !subject || !bodyHtml) {
      res.status(400).json({ error: "toEmail, subject, and bodyHtml are required" });
      return;
    }
    const tenantId = req.authUser?.tenantId ?? -1;
    const tenantRows = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
    const tenant = tenantRows[0];
    const settings = settingsRows[0];
    const smtp = buildSmtpConfig(settings as any);
    const brand = buildBrandConfig(tenant as any, settings as any);

    const payload = buildComposedEmail({ brand, subject, bodyHtml, to: toEmail });

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await sendEmail(payload, smtp);
    } catch (err: any) {
      status = "failed";
      errorMessage = err?.message || "Failed to send";
    }

    const row = await db.insert(sentEmailsTable).values({
      tenantId,
      sentByUserId: req.authUser?.id ?? null,
      leadId: leadId ?? null,
      toEmail,
      toName: toName || null,
      subject,
      bodyHtml,
      status,
      errorMessage,
    }).returning();

    res.status(201).json(row[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
