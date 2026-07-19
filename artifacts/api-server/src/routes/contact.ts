import { Router } from "express";
import { db } from "@workspace/db";
import { contactMessagesTable, tenantsTable, tenantSettingsTable, leadsTable, visualiserRequestsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireTenantAccess } from "../middlewares/auth";
import { publicFormRateLimiter } from "../middlewares/rateLimit";
import { sendEmail, buildContactAdminEmail, buildContactCustomerEmail, buildVisualiserAdminEmail } from "../lib/email";
import { sendSms } from "../lib/sms";
import { buildSmtpConfig, buildSmsCreds, buildBrandConfig } from "../lib/settingsHelpers";
import { fireNotification } from "../lib/notifications";

const router = Router();
function tid(req: any) { return req.authUser?.tenantId!; }

async function getTenantWithSettings(slug: string) {
  const tenants = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug)).limit(1);
  if (!tenants.length) return null;
  const settings = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenants[0].id)).limit(1);
  return { tenant: tenants[0], settings: settings[0] };
}

// Public contact form submission — send admin+customer emails directly (no toggle needed for generic contact)
async function handleContactMessage(req: any, res: any, slug: string) {
  try {
    const ts = await getTenantWithSettings(slug);
    if (!ts) { res.status(404).json({ error: "Tenant not found" }); return; }
    const { tenant, settings } = ts;
    const { tenantSlug: _slug, ...rest } = req.body;
    const msg = await db.insert(contactMessagesTable).values({ ...rest, tenantId: tenant.id, source: "contact_form" }).returning();

    const adminEmail = settings?.adminNotificationEmail || tenant.email;
    const senderName = req.body.senderName || "";
    const senderEmail = req.body.senderEmail;
    const senderPhone = req.body.senderPhone;
    const smtp = buildSmtpConfig(settings as any);
    const smsCreds = buildSmsCreds(settings as any);
    const adminPhone = settings?.adminNotificationPhone;
    const brand = buildBrandConfig(tenant as any, settings as any);

    if (adminEmail) {
      sendEmail(buildContactAdminEmail({ brand, name: senderName, email: senderEmail, phone: senderPhone, message: req.body.message }), smtp)
        .catch(e => req.log.error({ err: e }, "Failed to send contact admin email"));
    }
    if (senderEmail) {
      sendEmail(buildContactCustomerEmail({ brand, name: senderName, to: senderEmail }), smtp)
        .catch(e => req.log.error({ err: e }, "Failed to send contact customer email"));
    }
    if (adminPhone && smsCreds) {
      sendSms(adminPhone, `New contact from ${senderName || "someone"}${senderPhone ? ` — ${senderPhone}` : ""}`, smsCreds)
        .catch(e => req.log.error({ err: e }, "Failed to send contact admin SMS"));
    }

    res.status(201).json(msg[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
}

router.post("/public/:tenantSlug/contact", publicFormRateLimiter, (req, res) => handleContactMessage(req, res, req.params.tenantSlug as string));

// Alias at /contact (tenantSlug in body) for the generated API client
router.post("/contact", publicFormRateLimiter, (req, res) => {
  if (!req.body.tenantSlug) { res.status(400).json({ error: "tenantSlug required" }); return; }
  return handleContactMessage(req, res, req.body.tenantSlug);
});

// Public quote request — creates a lead then fires lead_new through the unified notification helper
async function handleQuoteRequest(req: any, res: any, slug: string) {
  try {
    const ts = await getTenantWithSettings(slug);
    if (!ts) { res.status(404).json({ error: "Tenant not found" }); return; }
    const { tenant } = ts;
    const { tenantSlug: _slug, ...rest } = req.body;
    const reference = `ENQ-${Date.now()}`;
    // Respect an explicit source (e.g. "Cost Calculator") so leads are attributable in the
    // dashboard; the standard quote form sends none, so those still default to "Website".
    const source = (rest as any).source || "Website";
    const lead = await db.insert(leadsTable).values({ ...rest, reference, tenantId: tenant.id, status: "New", source }).returning();
    res.status(201).json(lead[0]);

    // Fire through unified helper — respects per-channel toggles and sends admin alert + customer ack
    fireNotification({
      tenantId: tenant.id,
      event: "lead_new",
      firstName: lead[0].firstName ?? undefined,
      lastName: lead[0].lastName ?? undefined,
      customerEmail: lead[0].email ?? undefined,
      customerPhone: lead[0].phone ?? undefined,
      reference: lead[0].reference ?? undefined,
      serviceInterest: lead[0].serviceInterest ?? undefined,
      address: lead[0].address ?? undefined,
      postcode: lead[0].postcode ?? undefined,
      budget: lead[0].budget ?? undefined,
      notes: lead[0].notes ?? undefined,
      propertyType: lead[0].propertyType ?? undefined,
      propertyTypeOther: lead[0].propertyTypeOther ?? undefined,
      existingSurface: lead[0].existingSurface ?? undefined,
      desiredFinish: lead[0].desiredFinish ?? undefined,
      timeframe: lead[0].timeframe ?? undefined,
      photoUrls: (lead[0].photoUrls as string[] | null) ?? undefined,
      preferredContactMethod: lead[0].preferredContactMethod ?? undefined,
      bestTimeToContact: lead[0].bestTimeToContact ?? undefined,
      areaToRender: lead[0].areaToRender ?? undefined,
      areaToRenderOther: lead[0].areaToRenderOther ?? undefined,
      numberOfStoreys: lead[0].numberOfStoreys ?? undefined,
      wallArea: lead[0].wallArea ?? undefined,
      currentCondition: (lead[0].currentCondition as string[] | null) ?? undefined,
      preferredColour: lead[0].preferredColour ?? undefined,
      preferredColourOther: lead[0].preferredColourOther ?? undefined,
      requiresInsulation: lead[0].requiresInsulation ?? undefined,
      insulationThickness: lead[0].insulationThickness ?? undefined,
      insulationMaterial: lead[0].insulationMaterial ?? undefined,
      accessConditions: (lead[0].accessConditions as string[] | null) ?? undefined,
      propertyStatus: lead[0].propertyStatus ?? undefined,
      companyName: lead[0].companyName ?? undefined,
      // Construction (AMO Services) fields
      clientType: lead[0].clientType ?? undefined,
      projectDescription: lead[0].projectDescription ?? undefined,
      planningStatus: lead[0].planningStatus ?? undefined,
      hasDrawings: lead[0].hasDrawings ?? undefined,
      urgency: lead[0].urgency ?? undefined,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
}

router.post("/public/:tenantSlug/quote-request", publicFormRateLimiter, (req, res) => handleQuoteRequest(req, res, req.params.tenantSlug as string));

// Alias at /quote-request (tenantSlug in body) for the generated API client
router.post("/quote-request", publicFormRateLimiter, (req, res) => {
  if (!req.body.tenantSlug) { res.status(400).json({ error: "tenantSlug required" }); return; }
  return handleQuoteRequest(req, res, req.body.tenantSlug);
});

// Public visualiser submission — alias at /visualiser for generated API client
router.post("/visualiser", publicFormRateLimiter, async (req, res) => {
  try {
    const slug = req.body.tenantSlug;
    if (!slug) { res.status(400).json({ error: "tenantSlug required" }); return; }
    const ts = await getTenantWithSettings(slug);
    if (!ts) { res.status(404).json({ error: "Tenant not found" }); return; }
    const { tenant, settings } = ts;
    const { tenantSlug: _slug, ...rest } = req.body;
    const r = await db.insert(visualiserRequestsTable).values({ ...rest, tenantId: tenant.id, status: "pending" }).returning();

    const adminEmail = settings?.adminNotificationEmail || tenant.email;
    const smtp = buildSmtpConfig(settings as any);
    const smsCreds = buildSmsCreds(settings as any);
    const adminPhone = settings?.adminNotificationPhone;
    const brand = buildBrandConfig(tenant as any, settings as any);

    if (adminEmail) {
      sendEmail(buildVisualiserAdminEmail({ brand, adminEmail, name: req.body.firstName ? `${req.body.firstName} ${req.body.lastName || ""}`.trim() : req.body.name, email: req.body.email, phone: req.body.phone, renderColour: req.body.colourPreference || req.body.renderColour, notes: req.body.notes }), smtp)
        .catch(e => req.log.error({ err: e }, "Failed to send visualiser admin email"));
    }
    if (adminPhone && smsCreds) {
      const name = req.body.firstName ? `${req.body.firstName} ${req.body.lastName || ""}`.trim() : req.body.name || "someone";
      sendSms(adminPhone, `New visualiser request from ${name}`, smsCreds)
        .catch(e => req.log.error({ err: e }, "Failed to send visualiser admin SMS"));
    }

    res.status(201).json(r[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Public visualiser submission
router.post("/public/:tenantSlug/visualiser", publicFormRateLimiter, async (req, res) => {
  try {
    const ts = await getTenantWithSettings(req.params.tenantSlug as string);
    if (!ts) { res.status(404).json({ error: "Tenant not found" }); return; }
    const { tenant, settings } = ts;
    const r = await db.insert(visualiserRequestsTable).values({ ...req.body, tenantId: tenant.id, status: "pending" }).returning();

    const adminEmail = settings?.adminNotificationEmail || tenant.email;
    const smtp = buildSmtpConfig(settings as any);
    const smsCreds = buildSmsCreds(settings as any);
    const adminPhone = settings?.adminNotificationPhone;
    const brand = buildBrandConfig(tenant as any, settings as any);

    if (adminEmail) {
      sendEmail(buildVisualiserAdminEmail({ brand, adminEmail, name: req.body.name, email: req.body.email, phone: req.body.phone, renderColour: req.body.renderColour, notes: req.body.notes }), smtp)
        .catch(e => req.log.error({ err: e }, "Failed to send visualiser admin email"));
    }
    if (adminPhone && smsCreds) {
      sendSms(adminPhone, `New visualiser request from ${req.body.name || "someone"}`, smsCreds)
        .catch(e => req.log.error({ err: e }, "Failed to send visualiser admin SMS"));
    }

    res.status(201).json(r[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Admin: list contact messages
router.get("/contact/messages", requireTenantAccess, async (req, res) => {
  try {
    const msgs = await db.select().from(contactMessagesTable).where(eq(contactMessagesTable.tenantId, tid(req))).orderBy(sql`${contactMessagesTable.createdAt} desc`);
    res.json(msgs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/contact/messages/:id", requireTenantAccess, async (req, res) => {
  try {
    const msg = await db.select().from(contactMessagesTable).where(and(eq(contactMessagesTable.id, Number(req.params.id)), eq(contactMessagesTable.tenantId, tid(req)))).limit(1);
    if (!msg.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(msg[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/contact/messages/:id", requireTenantAccess, async (req, res) => {
  try {
    await db.delete(contactMessagesTable).where(and(eq(contactMessagesTable.id, Number(req.params.id)), eq(contactMessagesTable.tenantId, tid(req))));
    res.status(204).send();
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
