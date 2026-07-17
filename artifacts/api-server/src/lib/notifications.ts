import { db } from "@workspace/db";
import { tenantSettingsTable, tenantsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  sendEmail,
  buildLeadNewAdminEmail,
  buildLeadNewCustomerEmail,
  buildSurveyBookedCustomerEmail,
  buildQuoteSentCustomerEmail,
  buildQuoteAcceptedAdminEmail,
  buildPaymentReceivedAdminEmail,
  buildPaymentReceivedCustomerEmail,
  buildLeadWonCustomerEmail,
  buildProjectInProgressCustomerEmail,
  buildProjectCompleteCustomerEmail,
} from "./email";
import { sendSms } from "./sms";
import { buildSmtpConfig, buildSmsCreds } from "./settingsHelpers";
import { logger } from "./logger";

export type NotificationEvent =
  | "lead_new"
  | "survey_booked"
  | "quote_sent"
  | "quote_accepted"
  | "payment_received"
  | "lead_won"
  | "project_in_progress"
  | "project_completed";

export interface NotificationContext {
  tenantId: number;
  event: NotificationEvent;
  firstName?: string;
  lastName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  reference?: string;
  projectTitle?: string;
  paymentLinkUrl?: string;
  amount?: string;
  serviceInterest?: string;
  address?: string;
  postcode?: string;
  budget?: string;
  notes?: string;
  propertyType?: string;
  propertyTypeOther?: string;
  existingSurface?: string;
  desiredFinish?: string;
  timeframe?: string;
  photoUrls?: string[];
  preferredContactMethod?: string;
  bestTimeToContact?: string;
  areaToRender?: string;
  areaToRenderOther?: string;
  numberOfStoreys?: string;
  wallArea?: string;
  currentCondition?: string[];
  preferredColour?: string;
  preferredColourOther?: string;
  requiresInsulation?: string;
  insulationThickness?: string;
  insulationMaterial?: string;
  accessConditions?: string[];
  propertyStatus?: string;
  companyName?: string;
}

async function getTenantAndSettings(tenantId: number) {
  const tenants = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenants.length) return null;
  const settings = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  return { tenant: tenants[0], settings: settings[0] ?? null };
}

type Settings = typeof tenantSettingsTable.$inferSelect;

function emailEnabled(s: Settings | null, event: NotificationEvent): boolean {
  if (!s) return false;
  switch (event) {
    case "lead_new":           return s.notifyLeadNewEmail !== false;
    case "survey_booked":      return s.notifySurveyBookedEmail !== false;
    case "quote_sent":         return s.notifyQuoteSentEmail !== false;
    case "quote_accepted":     return s.notifyQuoteAcceptedEmail !== false;
    case "payment_received":  return s.notifyPaymentReceivedEmail !== false;
    case "lead_won":           return s.notifyLeadWonEmail !== false;
    case "project_in_progress":return s.notifyProjectInProgressEmail !== false;
    case "project_completed":  return s.notifyProjectCompleteEmail !== false;
    default: return false;
  }
}

function smsEnabled(s: Settings | null, event: NotificationEvent): boolean {
  if (!s) return false;
  switch (event) {
    case "lead_new":           return s.notifyLeadNewSms !== false;
    case "survey_booked":      return s.notifySurveyBookedSms !== false;
    case "quote_sent":         return s.notifyQuoteSentSms !== false;
    case "quote_accepted":     return s.notifyQuoteAcceptedSms !== false;
    case "payment_received":  return s.notifyPaymentReceivedSms !== false;
    case "lead_won":           return s.notifyLeadWonSms !== false;
    case "project_in_progress":return s.notifyProjectInProgressSms !== false;
    case "project_completed":  return s.notifyProjectCompleteSms !== false;
    default: return false;
  }
}

export async function fireNotification(ctx: NotificationContext): Promise<void> {
  try {
    const ts = await getTenantAndSettings(ctx.tenantId);
    if (!ts) return;
    const { tenant, settings } = ts;

    const smtp = buildSmtpConfig(settings as any);
    const smsCreds = buildSmsCreds(settings as any);
    const adminEmail = settings?.adminNotificationEmail || tenant.email || null;
    const adminPhone = settings?.adminNotificationPhone || null;
    const tenantPhone = settings?.phone || tenant.phone || "";
    const tenantEmail = settings?.email || tenant.email || "";

    const doAdminEmail  = emailEnabled(settings, ctx.event) && !!adminEmail && !!smtp;
    const doAdminSms    = smsEnabled(settings, ctx.event) && !!adminPhone && !!smsCreds;
    const doCustomerEmail = emailEnabled(settings, ctx.event) && !!ctx.customerEmail && !!smtp;
    const doCustomerSms   = smsEnabled(settings, ctx.event) && !!ctx.customerPhone && !!smsCreds;

    const firstName = ctx.firstName || ctx.customerName || "there";
    const fullName = ctx.firstName && ctx.lastName
      ? `${ctx.firstName} ${ctx.lastName}`.trim()
      : ctx.customerName || "Unknown";

    switch (ctx.event) {
      // ── lead_new: admin alert + customer acknowledgement ──────────────────
      case "lead_new": {
        if (doAdminEmail) {
          sendEmail(buildLeadNewAdminEmail({
            tenantName: tenant.name,
            adminEmail: adminEmail!,
            firstName: ctx.firstName || "",
            lastName: ctx.lastName || "",
            email: ctx.customerEmail,
            phone: ctx.customerPhone,
            reference: ctx.reference,
            serviceInterest: ctx.serviceInterest,
            address: ctx.address,
            postcode: ctx.postcode,
            budget: ctx.budget,
            notes: ctx.notes,
            propertyType: ctx.propertyType,
            propertyTypeOther: ctx.propertyTypeOther,
            existingSurface: ctx.existingSurface,
            desiredFinish: ctx.desiredFinish,
            timeframe: ctx.timeframe,
            photoUrls: ctx.photoUrls,
            preferredContactMethod: ctx.preferredContactMethod,
            bestTimeToContact: ctx.bestTimeToContact,
            areaToRender: ctx.areaToRender,
            areaToRenderOther: ctx.areaToRenderOther,
            numberOfStoreys: ctx.numberOfStoreys,
            wallArea: ctx.wallArea,
            currentCondition: ctx.currentCondition,
            preferredColour: ctx.preferredColour,
            preferredColourOther: ctx.preferredColourOther,
            requiresInsulation: ctx.requiresInsulation,
            insulationThickness: ctx.insulationThickness,
            insulationMaterial: ctx.insulationMaterial,
            accessConditions: ctx.accessConditions,
            propertyStatus: ctx.propertyStatus,
            companyName: ctx.companyName,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] lead_new admin email failed"));
        }
        if (doAdminSms) {
          sendSms(adminPhone!, `New lead: ${fullName}${ctx.customerPhone ? ` — ${ctx.customerPhone}` : ""}`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] lead_new admin SMS failed"));
        }
        if (doCustomerEmail) {
          sendEmail(buildLeadNewCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            tenantEmail,
            firstName,
            serviceInterest: ctx.serviceInterest,
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] lead_new customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, thanks for contacting ${tenant.name}! We'll be in touch within 24 hours. — ${tenant.name}`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] lead_new customer SMS failed"));
        }
        break;
      }

      // ── survey_booked: customer notification ─────────────────────────────
      case "survey_booked": {
        if (doCustomerEmail) {
          sendEmail(buildSurveyBookedCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            firstName,
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] survey_booked customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, your survey has been booked with ${tenant.name}! We'll confirm date/time shortly.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] survey_booked customer SMS failed"));
        }
        break;
      }

      // ── quote_sent: customer-only notification ────────────────────────────
      case "quote_sent": {
        if (doCustomerEmail) {
          sendEmail(buildQuoteSentCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            tenantEmail,
            firstName,
            reference: ctx.reference,
            paymentLinkUrl: ctx.paymentLinkUrl,
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] quote_sent customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, your quote${ctx.reference ? ` (${ctx.reference})` : ""} from ${tenant.name} is ready. Call ${tenantPhone} for questions.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] quote_sent customer SMS failed"));
        }
        break;
      }

      // ── quote_accepted: admin alert only ─────────────────────────────────
      case "quote_accepted": {
        if (doAdminEmail) {
          sendEmail(buildQuoteAcceptedAdminEmail({
            tenantName: tenant.name,
            adminEmail: adminEmail!,
            reference: ctx.reference || "—",
            customerName: fullName !== "Unknown" ? fullName : undefined,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] quote_accepted admin email failed"));
        }
        if (doAdminSms) {
          sendSms(adminPhone!, `Quote ${ctx.reference || ""}${fullName !== "Unknown" ? ` from ${fullName}` : ""} accepted!`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] quote_accepted admin SMS failed"));
        }
        break;
      }

      // ── payment_received: admin alert + customer receipt ──────────────────
      case "payment_received": {
        if (doAdminEmail) {
          sendEmail(buildPaymentReceivedAdminEmail({
            tenantName: tenant.name,
            adminEmail: adminEmail!,
            reference: ctx.reference || "—",
            amount: ctx.amount || "—",
            customerName: fullName !== "Unknown" ? fullName : undefined,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] payment_received admin email failed"));
        }
        if (doAdminSms) {
          sendSms(adminPhone!, `Payment received: ${ctx.amount || "—"} against quote ${ctx.reference || ""}${fullName !== "Unknown" ? ` from ${fullName}` : ""}.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] payment_received admin SMS failed"));
        }
        if (doCustomerEmail) {
          sendEmail(buildPaymentReceivedCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            firstName,
            reference: ctx.reference,
            amount: ctx.amount || "—",
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] payment_received customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, we've received your payment of ${ctx.amount || "—"}${ctx.reference ? ` for quote ${ctx.reference}` : ""}. Thank you! — ${tenant.name}`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] payment_received customer SMS failed"));
        }
        break;
      }

      // ── lead_won: customer notification ───────────────────────────────────
      case "lead_won": {
        if (doCustomerEmail) {
          sendEmail(buildLeadWonCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            firstName,
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] lead_won customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, great news! Your project with ${tenant.name} is confirmed. We'll be in touch to schedule the work.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] lead_won customer SMS failed"));
        }
        break;
      }

      // ── project_in_progress: customer notification ────────────────────────
      case "project_in_progress": {
        if (doCustomerEmail) {
          sendEmail(buildProjectInProgressCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            firstName,
            projectTitle: ctx.projectTitle || "your project",
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] project_in_progress customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, work has started on "${ctx.projectTitle || "your project"}" with ${tenant.name}. Questions? Call ${tenantPhone}.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] project_in_progress customer SMS failed"));
        }
        break;
      }

      // ── project_completed: customer notification ──────────────────────────
      case "project_completed": {
        if (doCustomerEmail) {
          sendEmail(buildProjectCompleteCustomerEmail({
            tenantName: tenant.name,
            tenantPhone,
            firstName,
            projectTitle: ctx.projectTitle || "your project",
            to: ctx.customerEmail!,
          }), smtp!).catch(e => logger.error({ err: e }, "[notify] project_completed customer email failed"));
        }
        if (doCustomerSms) {
          sendSms(ctx.customerPhone!, `Hi ${firstName}, your project "${ctx.projectTitle || "your project"}" with ${tenant.name} is complete! Thank you for choosing us.`, smsCreds!)
            .catch(e => logger.error({ err: e }, "[notify] project_completed customer SMS failed"));
        }
        break;
      }
    }
  } catch (err) {
    logger.error({ err }, `[notify] unhandled error for event ${ctx.event}`);
  }
}
