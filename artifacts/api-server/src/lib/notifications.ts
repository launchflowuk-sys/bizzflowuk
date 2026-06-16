import { db } from "@workspace/db";
import { tenantSettingsTable, tenantsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { buildSmtpConfig, buildSmsCreds } from "./settingsHelpers";
import { logger } from "./logger";

export type NotificationEvent =
  | "lead_new"
  | "lead_status_change"
  | "quote_status_change"
  | "project_status_change"
  | "project_completed"
  | "review_request";

export interface NotificationContext {
  tenantId: number;
  event: NotificationEvent;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  leadName?: string;
  oldStatus?: string;
  newStatus?: string;
  reference?: string;
  projectTitle?: string;
  reviewPlatformUrl?: string;
  reviewRequestTemplate?: string;
}

async function getTenantAndSettings(tenantId: number) {
  const tenants = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenants.length) return null;
  const settings = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  return { tenant: tenants[0], settings: settings[0] ?? null };
}

function shouldNotify(settings: Record<string, unknown> | null, event: NotificationEvent): boolean {
  if (!settings) return false;
  switch (event) {
    case "lead_new": return settings.notifyLeadNew !== false;
    case "lead_status_change": return settings.notifyLeadStatusChange !== false;
    case "quote_status_change": return settings.notifyQuoteStatusChange !== false;
    case "project_status_change": return settings.notifyProjectStatusChange !== false;
    case "project_completed": return settings.notifyProjectComplete !== false;
    case "review_request": return settings.reviewRequestEnabled === true;
    default: return false;
  }
}

function buildAdminEmailPayload(event: NotificationEvent, ctx: NotificationContext, tenantName: string) {
  switch (event) {
    case "lead_new":
      return {
        subject: `New Lead — ${ctx.leadName || ctx.customerName || "Unknown"}`,
        html: `<h2>New Lead Received</h2><p>A new lead has been added to your ${tenantName} CRM.</p><p><strong>Name:</strong> ${ctx.leadName || ctx.customerName || "—"}</p>${ctx.customerEmail ? `<p><strong>Email:</strong> ${ctx.customerEmail}</p>` : ""}${ctx.customerPhone ? `<p><strong>Phone:</strong> ${ctx.customerPhone}</p>` : ""}`,
        text: `New lead: ${ctx.leadName || ctx.customerName}. Email: ${ctx.customerEmail}. Phone: ${ctx.customerPhone}.`,
      };
    case "lead_status_change":
      return {
        subject: `Lead Status Updated — ${ctx.leadName || ctx.customerName}`,
        html: `<h2>Lead Status Changed</h2><p>The lead <strong>${ctx.leadName || ctx.customerName}</strong> has moved from <strong>${ctx.oldStatus}</strong> to <strong>${ctx.newStatus}</strong>.</p>`,
        text: `Lead ${ctx.leadName || ctx.customerName}: ${ctx.oldStatus} → ${ctx.newStatus}`,
      };
    case "quote_status_change":
      return {
        subject: `Quote Status Updated — ${ctx.reference}`,
        html: `<h2>Quote Status Changed</h2><p>Quote <strong>${ctx.reference}</strong> has moved from <strong>${ctx.oldStatus}</strong> to <strong>${ctx.newStatus}</strong>.</p>`,
        text: `Quote ${ctx.reference}: ${ctx.oldStatus} → ${ctx.newStatus}`,
      };
    case "project_status_change":
      return {
        subject: `Project Status Updated — ${ctx.projectTitle}`,
        html: `<h2>Project Status Changed</h2><p>Project <strong>${ctx.projectTitle}</strong> has moved from <strong>${ctx.oldStatus}</strong> to <strong>${ctx.newStatus}</strong>.</p>`,
        text: `Project ${ctx.projectTitle}: ${ctx.oldStatus} → ${ctx.newStatus}`,
      };
    case "project_completed":
      return {
        subject: `Project Completed — ${ctx.projectTitle}`,
        html: `<h2>Project Completed</h2><p>Project <strong>${ctx.projectTitle}</strong> has been marked as completed. Consider sending a review request to the customer.</p>`,
        text: `Project ${ctx.projectTitle} has been marked as completed.`,
      };
    default:
      return null;
  }
}

function buildCustomerEmailPayload(event: NotificationEvent, ctx: NotificationContext, tenantName: string, tenantPhone: string) {
  switch (event) {
    case "project_status_change":
      return {
        subject: `Your project update — ${tenantName}`,
        html: `<h2>Project Update</h2><p>Hi ${ctx.customerName || "there"},</p><p>Your project <strong>${ctx.projectTitle}</strong> has moved to <strong>${ctx.newStatus}</strong>.</p><p>If you have any questions please don't hesitate to get in touch.</p><p>— The ${tenantName} Team</p>`,
        text: `Hi ${ctx.customerName}, your project "${ctx.projectTitle}" is now ${ctx.newStatus}. Contact us on ${tenantPhone} if you have questions.`,
      };
    case "project_completed":
      return {
        subject: `Your project is complete — ${tenantName}`,
        html: `<h2>Great news, ${ctx.customerName || "there"}!</h2><p>Your project <strong>${ctx.projectTitle}</strong> is now complete. Thank you for choosing ${tenantName}.</p><p>We hope you're delighted with the result. If you have any questions or concerns please get in touch on <a href="tel:${tenantPhone}">${tenantPhone}</a>.</p><p>— The ${tenantName} Team</p>`,
        text: `Hi ${ctx.customerName}, your project "${ctx.projectTitle}" is now complete. Thank you for choosing ${tenantName}!`,
      };
    case "review_request": {
      const template = ctx.reviewRequestTemplate || `Hi ${ctx.customerName || "there"},\n\nWe hope you're enjoying the results of your recent project with ${tenantName}!\n\nIf you have a moment, we'd really appreciate it if you could leave us a review — it only takes a minute and helps other homeowners find us.\n\n${ctx.reviewPlatformUrl ? `Leave a review here: ${ctx.reviewPlatformUrl}` : ""}\n\nThank you so much!\n— The ${tenantName} Team`;
      return {
        subject: `We'd love your feedback — ${tenantName}`,
        html: `<p>${template.replace(/\n/g, "<br>")}</p>`,
        text: template,
      };
    }
    default:
      return null;
  }
}

function buildAdminSmsBody(event: NotificationEvent, ctx: NotificationContext): string {
  switch (event) {
    case "lead_new": return `New lead: ${ctx.leadName || ctx.customerName}${ctx.customerPhone ? ` — ${ctx.customerPhone}` : ""}`;
    case "lead_status_change": return `Lead ${ctx.leadName || ctx.customerName}: ${ctx.oldStatus} → ${ctx.newStatus}`;
    case "quote_status_change": return `Quote ${ctx.reference}: ${ctx.oldStatus} → ${ctx.newStatus}`;
    case "project_status_change": return `Project "${ctx.projectTitle}": ${ctx.oldStatus} → ${ctx.newStatus}`;
    case "project_completed": return `Project "${ctx.projectTitle}" marked as completed.`;
    default: return "";
  }
}

function buildCustomerSmsBody(event: NotificationEvent, ctx: NotificationContext, tenantName: string): string {
  switch (event) {
    case "project_status_change": return `Hi ${ctx.customerName || "there"}, your project "${ctx.projectTitle}" is now ${ctx.newStatus}. — ${tenantName}`;
    case "project_completed": return `Hi ${ctx.customerName || "there"}, your project "${ctx.projectTitle}" is complete! Thank you for choosing ${tenantName}.`;
    case "review_request": return `Hi ${ctx.customerName || "there"}, we'd love your feedback on your recent project. ${ctx.reviewPlatformUrl ? `Leave a review: ${ctx.reviewPlatformUrl}` : ""} — ${tenantName}`;
    default: return "";
  }
}

const CUSTOMER_EVENTS: NotificationEvent[] = ["project_status_change", "project_completed", "review_request"];
const ADMIN_EVENTS: NotificationEvent[] = ["lead_new", "lead_status_change", "quote_status_change", "project_status_change", "project_completed"];

export async function fireNotification(ctx: NotificationContext): Promise<void> {
  try {
    const ts = await getTenantAndSettings(ctx.tenantId);
    if (!ts) return;
    const { tenant, settings } = ts;

    if (!shouldNotify(settings as any, ctx.event)) return;

    const smtp = buildSmtpConfig(settings as any);
    const smsCreds = buildSmsCreds(settings as any);
    const adminEmail = (settings as any)?.adminNotificationEmail || tenant.email;
    const adminPhone = (settings as any)?.adminNotificationPhone;

    if (ADMIN_EVENTS.includes(ctx.event)) {
      const payload = buildAdminEmailPayload(ctx.event, ctx, tenant.name);
      if (payload && adminEmail && smtp) {
        sendEmail({ ...payload, to: adminEmail }, smtp)
          .catch(e => logger.error({ err: e }, `[notify] admin email failed for ${ctx.event}`));
      }
      const smsBody = buildAdminSmsBody(ctx.event, ctx);
      if (smsBody && adminPhone && smsCreds) {
        sendSms(adminPhone, smsBody, smsCreds)
          .catch(e => logger.error({ err: e }, `[notify] admin SMS failed for ${ctx.event}`));
      }
    }

    if (CUSTOMER_EVENTS.includes(ctx.event) && ctx.customerEmail) {
      const payload = buildCustomerEmailPayload(ctx.event, ctx, tenant.name, tenant.phone || "");
      if (payload && smtp) {
        sendEmail({ ...payload, to: ctx.customerEmail }, smtp)
          .catch(e => logger.error({ err: e }, `[notify] customer email failed for ${ctx.event}`));
      }
      if (ctx.customerPhone && smsCreds) {
        const smsBody = buildCustomerSmsBody(ctx.event, ctx, tenant.name);
        if (smsBody) {
          sendSms(ctx.customerPhone, smsBody, smsCreds)
            .catch(e => logger.error({ err: e }, `[notify] customer SMS failed for ${ctx.event}`));
        }
      }
    }
  } catch (err) {
    logger.error({ err }, `[notify] unhandled error for event ${ctx.event}`);
  }
}
