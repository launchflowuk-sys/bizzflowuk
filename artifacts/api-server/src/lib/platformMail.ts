import { sendEmail, type SmtpConfig } from "./email";
import { renderEmailShell, emailButton, emailDataTable, type BrandConfig } from "./emailShell";
import { logger } from "./logger";

/**
 * The platform's own mailbox — BizzFlowUK writing as itself.
 *
 * WHY THIS DID NOT EXIST, AND WHAT IT COST. Every email the platform could
 * send went out through a TENANT's SMTP credentials, typed into their own
 * Settings page. That is right for a quote or an invoice: those are from the
 * trade to their customer, in the trade's name. It is useless for anything the
 * platform itself needs to say, because:
 *
 *   - Signup sent nothing. A new business appeared in the database and the only
 *     trace was a log line nobody reads. No welcome to them, no alert to us.
 *   - A new subscription sent nothing. Somebody could start paying GBP 99 a
 *     month and the first anyone would know is a Stripe payout.
 *   - The Help Centre sent support requests through the TENANT's SMTP, so a
 *     business on day one of a trial - who has not set SMTP up and never
 *     will have - was told "email isn't configured for your account yet" at
 *     exactly the moment they needed help most.
 *
 * All three are the same missing piece: nowhere for the platform to send from.
 *
 * TWO ADDRESSES, ON PURPOSE.
 *   FROM is a BizzFlowUK address (PLATFORM_SMTP_FROM). A plumber who signed up
 *   to BizzFlowUK and gets mail from a launchflow.co.uk address he has never
 *   heard of reads it as phishing, and spam filters agree with him.
 *   ALERTS go to one LaunchFlow inbox (PLATFORM_ALERT_EMAIL) so signups from
 *   every product land in the same place.
 *
 * Nothing in here throws. A notification that fails must never take down the
 * signup that triggered it - losing the alert costs an email, losing the signup
 * costs a customer.
 */

const DEFAULT_ALERT_EMAIL = "shujaat@launchflow.co.uk";
const DEFAULT_FROM = "BizzFlowUK <hello@bizzflowuk.com>";

/** Where the dashboard lives, for links inside emails. */
export function appBaseUrl(): string {
  return (process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com").replace(/\/+$/, "");
}

/** Who gets told when something happens on the platform. */
export function platformAlertEmail(): string {
  return (process.env["PLATFORM_ALERT_EMAIL"] || DEFAULT_ALERT_EMAIL).trim();
}

/**
 * The platform's SMTP credentials, or null when they have not been set.
 *
 * Deliberately env-only. These are OUR credentials for OUR mailbox; putting
 * them in a settings table would mean a tenant admin could read or change the
 * address the platform speaks from.
 */
export function platformSmtp(): SmtpConfig | null {
  const host = process.env["PLATFORM_SMTP_HOST"];
  const user = process.env["PLATFORM_SMTP_USER"];
  const pass = process.env["PLATFORM_SMTP_PASS"];
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(process.env["PLATFORM_SMTP_PORT"] || 587),
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS. Getting this wrong
    // hangs the connection rather than failing, so it follows the port unless
    // told otherwise.
    secure: process.env["PLATFORM_SMTP_SECURE"]
      ? process.env["PLATFORM_SMTP_SECURE"] === "true"
      : Number(process.env["PLATFORM_SMTP_PORT"] || 587) === 465,
    user,
    pass,
    from: process.env["PLATFORM_SMTP_FROM"] || DEFAULT_FROM,
  };
}

export function platformMailReady(): boolean {
  return platformSmtp() !== null;
}

/** BizzFlowUK's own branding for the shared email shell. */
function platformBrand(): BrandConfig {
  return {
    tenantName: "BizzFlowUK",
    primaryColor: "#0E7C66",
    secondaryColor: "#0c3f35",
    email: platformAlertEmail(),
    websiteUrl: appBaseUrl(),
  };
}

export interface PlatformEmail {
  to?: string;
  subject: string;
  heading: string;
  intro?: string;
  preheader?: string;
  rows?: Array<[label: string, value: string | undefined]>;
  bodyHtml?: string;
  button?: { label: string; url: string };
  /** So hitting Reply on an alert about a business answers the business. */
  replyTo?: string;
}

/**
 * Send as the platform. Resolves either way — callers must not have to care.
 *
 * Returns whether it actually went, for the few callers (the Help Centre) that
 * need to tell the user something different when it did not.
 */
export async function sendPlatformEmail(mail: PlatformEmail): Promise<boolean> {
  const smtp = platformSmtp();
  const to = mail.to || platformAlertEmail();

  if (!smtp) {
    logger.warn(
      { to, subject: mail.subject },
      "[platform-mail] NOT SENT - PLATFORM_SMTP_* is not configured",
    );
    return false;
  }

  const body = [
    mail.bodyHtml || "",
    mail.rows?.length ? emailDataTable(mail.rows) : "",
    mail.button ? emailButton(mail.button.label, mail.button.url, "#0E7C66") : "",
  ].filter(Boolean).join("");

  try {
    await sendEmail({
      to,
      subject: mail.subject,
      replyTo: mail.replyTo,
      html: renderEmailShell({
        brand: platformBrand(),
        heading: mail.heading,
        intro: mail.intro,
        preheader: mail.preheader,
        bodyHtml: body,
      }),
    }, smtp);
    logger.info({ to, subject: mail.subject }, "[platform-mail] sent");
    return true;
  } catch (err) {
    logger.error({ err, to, subject: mail.subject }, "[platform-mail] send failed");
    return false;
  }
}

/**
 * Fire a platform email without making the caller wait or handle failure.
 *
 * Used on the signup and webhook paths, where the response must go back
 * immediately and an SMTP server having a bad day is not the customer's
 * problem.
 */
export function firePlatformEmail(mail: PlatformEmail): void {
  void sendPlatformEmail(mail).catch(err =>
    logger.error({ err, subject: mail.subject }, "[platform-mail] unexpected failure"),
  );
}
