import { Router } from "express";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@workspace/db";
import { sentEmailsTable, tenantsTable, tenantSettingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess, tenantFilter } from "../middlewares/auth";
import { sendEmail, buildComposedEmail, type EmailAttachment } from "../lib/email";
import { buildSmtpConfig, buildBrandConfig, buildSmsCreds } from "../lib/settingsHelpers";
import { sendSms } from "../lib/sms";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();

/**
 * POST /sms/send — send a one-off SMS to a customer using the tenant's own Twilio credentials
 * (the same creds the automated notifications use). Powers the "reply by text" action on the
 * Messages page. 400s clearly if the tenant hasn't set Twilio up yet.
 */
router.post("/sms/send", requireTenantAccess, async (req, res) => {
  try {
    const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!to || !body) { res.status(400).json({ error: "to and body are required" }); return; }

    const tenantId = req.authUser?.tenantId ?? -1;
    const settingsRows = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
    const creds = buildSmsCreds(settingsRows[0] as any);
    if (!creds) { res.status(400).json({ error: "SMS isn't set up yet — add your Twilio details in Settings first." }); return; }

    await sendSms(to, body, creds);
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to send SMS");
    res.status(502).json({ error: err?.message || "Failed to send SMS" });
  }
});
const objectStorageService = new ObjectStorageService();

router.get("/emails", requireTenantAccess, async (req, res) => {
  try {
    const rows = await db.select().from(sentEmailsTable)
      .where(tenantFilter(req, sentEmailsTable.tenantId))
      .orderBy(sql`${sentEmailsTable.createdAt} desc`);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Resolves previously-uploaded object paths (from the dashboard upload endpoint) into real
// email attachments by reading the file straight off disk — the /storage/objects/* route
// requires an authenticated browser session, which nodemailer's remote fetch doesn't have.
async function resolveAttachments(objectPaths: string[], tenantId: number, log: { error: (obj: unknown, msg?: string) => void }): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];
  for (let i = 0; i < objectPaths.length; i++) {
    try {
      const { absolutePath, contentType } = await objectStorageService.resolveForDownload(objectPaths[i], { tenantId, isSuperAdmin: false });
      const content = await readFile(absolutePath);
      attachments.push({ filename: `Attachment ${i + 1}${path.extname(absolutePath)}`, content, contentType });
    } catch (err) {
      log.error({ err, objectPath: objectPaths[i] }, "Failed to resolve email attachment — skipping it");
    }
  }
  return attachments;
}

// Sent emails are a leaf table (nothing references them), so a scoped delete is safe as-is.
router.delete("/emails/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(sentEmailsTable)
      .where(and(eq(sentEmailsTable.id, Number(req.params.id)), tenantFilter(req, sentEmailsTable.tenantId)));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Sends a Mark-composed email through the same branded shell as the automated notifications,
// then logs it (outbound only — this is not a synced inbox, per the scoped-down request).
router.post("/emails/compose", requireTenantAccess, async (req, res) => {
  try {
    const { toEmail, toName, subject, bodyHtml, leadId, attachmentUrls } = req.body;
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

    const validUrls: string[] = Array.isArray(attachmentUrls) ? attachmentUrls.filter((u: unknown) => typeof u === "string") : [];
    const attachments = validUrls.length ? await resolveAttachments(validUrls, tenantId, req.log) : undefined;

    const payload = buildComposedEmail({ brand, subject, bodyHtml, to: toEmail, attachments });

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
      attachmentUrls: validUrls,
      status,
      errorMessage,
    }).returning();

    res.status(201).json(row[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
