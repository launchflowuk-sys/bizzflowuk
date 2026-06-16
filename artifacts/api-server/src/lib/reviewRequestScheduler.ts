import { db } from "@workspace/db";
import { projectsTable, tenantSettingsTable, tenantsTable, customersTable } from "@workspace/db";
import { eq, isNull, lte, and, sql } from "drizzle-orm";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { buildSmtpConfig, buildSmsCreds } from "./settingsHelpers";
import { logger } from "./logger";

const INTERVAL_MS = 15 * 60 * 1000;

async function runReviewRequests() {
  try {
    const now = new Date();

    const rows = await db
      .select({
        project: projectsTable,
        settings: tenantSettingsTable,
        tenant: tenantsTable,
        customer: customersTable,
      })
      .from(projectsTable)
      .innerJoin(tenantSettingsTable, eq(tenantSettingsTable.tenantId, projectsTable.tenantId))
      .innerJoin(tenantsTable, eq(tenantsTable.id, projectsTable.tenantId))
      .leftJoin(customersTable, eq(customersTable.id, projectsTable.customerId))
      .where(
        and(
          eq(projectsTable.status, "Completed"),
          isNull(projectsTable.reviewRequestSentAt),
          eq(tenantSettingsTable.reviewRequestEnabled, true),
        )
      );

    for (const row of rows) {
      const { project, settings, tenant, customer } = row;

      if (!project.completedAt) continue;

      const delayDays = settings.reviewRequestDelayDays ?? 3;
      const sendAfter = new Date(project.completedAt.getTime() + delayDays * 24 * 60 * 60 * 1000);
      if (now < sendAfter) continue;

      const customerEmail = customer?.email;
      const customerPhone = customer?.phone;
      const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : undefined;
      const reviewPlatformUrl = settings.reviewPlatformUrl ?? undefined;
      const reviewTemplate = settings.reviewRequestTemplate ?? undefined;

      const resolvedTemplate = reviewTemplate
        || `Hi ${customerName || "there"},\n\nWe hope you're enjoying the results of your recent project with ${tenant.name}!\n\nIf you have a moment, we'd love it if you could leave us a review — it only takes a minute and helps other homeowners find us.\n\n${reviewPlatformUrl ? `Leave a review: ${reviewPlatformUrl}` : ""}\n\nThank you so much!\n— The ${tenant.name} Team`;

      const smtp = buildSmtpConfig(settings as any);
      const smsCreds = buildSmsCreds(settings as any);

      if (customerEmail && smtp) {
        await sendEmail({
          to: customerEmail,
          subject: `We'd love your feedback — ${tenant.name}`,
          html: `<p>${resolvedTemplate.replace(/\n/g, "<br>")}</p>`,
          text: resolvedTemplate,
        }, smtp).catch(e => logger.error({ err: e, projectId: project.id }, "[review-scheduler] email send failed"));
      }

      if (customerPhone && smsCreds) {
        const smsBody = `Hi ${customerName || "there"}, we'd love your feedback on your recent project with ${tenant.name}.${reviewPlatformUrl ? ` Leave a review: ${reviewPlatformUrl}` : ""}`;
        await sendSms(customerPhone, smsBody, smsCreds)
          .catch(e => logger.error({ err: e, projectId: project.id }, "[review-scheduler] SMS send failed"));
      }

      await db.update(projectsTable)
        .set({ reviewRequestSentAt: now })
        .where(eq(projectsTable.id, project.id));

      logger.info({ projectId: project.id, customerEmail, customerPhone }, "[review-scheduler] review request sent");
    }
  } catch (err) {
    logger.error({ err }, "[review-scheduler] run failed");
  }
}

export function startReviewRequestScheduler() {
  logger.info("[review-scheduler] starting (15-min interval)");
  runReviewRequests();
  setInterval(runReviewRequests, INTERVAL_MS);
}
