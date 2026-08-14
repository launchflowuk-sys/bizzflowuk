import { db } from "@workspace/db";
import { sentEmailsTable } from "@workspace/db";
import { sendEmail, type EmailPayload, type SmtpConfig } from "./email";
import { logger } from "./logger";

/**
 * Sends an automated notification and records the attempt in sent_emails.
 *
 * The recording is the point. `sendEmail` returns normally when SMTP isn't configured and
 * `fireNotification` swallows send errors, both deliberately — a failed notification must never
 * break the request that triggered it. The cost was that failure looked exactly like success
 * from every angle a tenant could see: the API returned 200, the dashboard said sent, and
 * nothing had left the building.
 *
 * Writing a row for every attempt — delivered, failed, or never attempted because there were no
 * credentials — gives the dashboard something truthful to show.
 *
 * Never throws. A logging failure must not take down the notification path it's observing.
 */
export async function sendAndRecord(
  payload: EmailPayload,
  smtp: SmtpConfig | null | undefined,
  meta: { tenantId: number; event: string; leadId?: number | null },
): Promise<void> {
  const base = {
    tenantId: meta.tenantId,
    event: meta.event,
    leadId: meta.leadId ?? null,
    toEmail: payload.to,
    subject: payload.subject,
  };

  const configured = !!(smtp?.host && smtp?.user && smtp?.pass);
  if (!configured) {
    await record({
      ...base,
      bodyHtml: null,
      status: "failed" as const,
      errorMessage: "Email is not set up — add your SMTP details in Settings so this can send.",
    });
    logger.warn({ event: meta.event, to: payload.to }, "[email] not sent — SMTP not configured");
    return;
  }

  try {
    await sendEmail(payload, smtp);
    await record({ ...base, bodyHtml: payload.html, status: "sent" as const, errorMessage: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await record({ ...base, bodyHtml: payload.html, status: "failed" as const, errorMessage: message });
    logger.error({ err, event: meta.event, to: payload.to }, "[email] send failed");
  }
}

async function record(row: {
  tenantId: number; event: string; leadId: number | null; toEmail: string; subject: string;
  bodyHtml: string | null; status: "sent" | "failed"; errorMessage: string | null;
}): Promise<void> {
  try {
    await db.insert(sentEmailsTable).values(row);
  } catch (err) {
    logger.error({ err }, "[email] could not write the delivery log — send itself was unaffected");
  }
}
