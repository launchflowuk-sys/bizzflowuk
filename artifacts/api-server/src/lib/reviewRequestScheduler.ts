import { db } from "@workspace/db";
import { projectsTable, tenantSettingsTable, tenantsTable, customersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { sendEmail, buildReviewRequestEmail } from "./email";
import { sendSms } from "./sms";
import { buildSmtpConfig, buildSmsCreds, buildBrandConfig } from "./settingsHelpers";
import { logger } from "./logger";

const INTERVAL_MS = 15 * 60 * 1000;

const PLATFORM_BASE_URL = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";

function deriveReviewUrl(opts: {
  customDomain?: string | null;
  reviewPlatformUrl?: string | null;
  tenantSlug: string;
}): string {
  if (opts.reviewPlatformUrl) return opts.reviewPlatformUrl;
  if (opts.customDomain) return `https://${opts.customDomain}#reviews`;
  return `${PLATFORM_BASE_URL}/site/${opts.tenantSlug}#reviews`;
}

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

      // Use completedAt; fall back to updatedAt if not stamped
      const completionTime = project.completedAt ?? project.updatedAt;
      const delayHours = settings.reviewRequestDelayHours ?? 24;
      const sendAfter = new Date(completionTime.getTime() + delayHours * 60 * 60 * 1000);
      if (now < sendAfter) continue;

      const customerEmail = customer?.email ?? null;
      const customerPhone = customer?.phone ?? null;
      const customerFirstName = customer?.firstName ?? undefined;
      const channel = settings.reviewRequestChannel ?? "email";

      const reviewUrl = deriveReviewUrl({
        customDomain: tenant.customDomain,
        reviewPlatformUrl: settings.reviewPlatformUrl,
        tenantSlug: tenant.slug,
      });

      const smtp = buildSmtpConfig(settings as any);
      const smsCreds = buildSmsCreds(settings as any);

      let sentEmail = false;
      let sentSms = false;

      if ((channel === "email" || channel === "both") && customerEmail && smtp) {
        try {
          await sendEmail(
            buildReviewRequestEmail({
              brand: buildBrandConfig(tenant as any, settings as any),
              firstName: customerFirstName,
              reviewUrl,
              customTemplate: settings.reviewRequestTemplate ?? undefined,
              to: customerEmail,
            }),
            smtp
          );
          sentEmail = true;
        } catch (e) {
          logger.error({ err: e, projectId: project.id }, "[review-scheduler] email send failed");
        }
      }

      if ((channel === "sms" || channel === "both") && customerPhone && smsCreds) {
        const name = customerFirstName || "there";
        const smsBody = settings.reviewRequestTemplate
          ? settings.reviewRequestTemplate
              .replace(/\{name\}/g, name)
              .replace(/\{reviewUrl\}/g, reviewUrl)
              .substring(0, 160)
          : `Hi ${name}, we'd love your feedback on your recent project with ${tenant.name}. Leave a review: ${reviewUrl}`;
        try {
          await sendSms(customerPhone, smsBody, smsCreds);
          sentSms = true;
        } catch (e) {
          logger.error({ err: e, projectId: project.id }, "[review-scheduler] SMS send failed");
        }
      }

      // Only stamp reviewRequestSentAt if at least one channel delivered successfully
      const wantEmail = channel === "email" || channel === "both";
      const wantSms = channel === "sms" || channel === "both";
      const emailOk = !wantEmail || !customerEmail || !smtp || sentEmail;
      const smsOk = !wantSms || !customerPhone || !smsCreds || sentSms;
      const allDelivered = emailOk && smsOk && (sentEmail || sentSms);

      if (allDelivered) {
        await db.update(projectsTable)
          .set({ reviewRequestSentAt: now })
          .where(eq(projectsTable.id, project.id));
        logger.info({ projectId: project.id, customerEmail, customerPhone, channel }, "[review-scheduler] review request sent");
      }
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
