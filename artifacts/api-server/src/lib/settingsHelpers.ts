import type { SmtpConfig } from "./email";
import type { SmsCreds } from "./sms";
import type { SquareCreds } from "./square";

/**
 * Fields from tenantSettings that are safe to expose on the unauthenticated public site
 * endpoint. This is an ALLOWLIST — any new column added to the table will be hidden from
 * the public by default unless it is explicitly listed here.
 */
const PUBLIC_SETTINGS_ALLOWLIST = new Set([
  "id", "tenantId",
  "logoUrl", "faviconUrl",
  "primaryColor", "secondaryColor", "accentColor",
  "heroHeadline", "heroSubheadline", "ctaText", "ctaUrl",
  "aboutText", "serviceAreaText", "footerText",
  "email", "phone", "address", "city", "description",
  "socialFacebook", "socialInstagram", "socialTwitter", "socialLinkedin",
  "googleAnalyticsId",
  "createdAt", "updatedAt",
]);

/**
 * Return only presentation-safe fields for unauthenticated public responses.
 * Any sensitive, operational, or credential field is excluded by default.
 */
export function publicSettingsOnly(row: Record<string, unknown> | null | undefined) {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => PUBLIC_SETTINGS_ALLOWLIST.has(k))
  );
}

/**
 * For authenticated settings responses: mask secrets as empty strings so the client
 * knows the field exists (and can leave it blank to preserve the stored value)
 * without ever receiving the actual credential.
 */
export function maskSecretsForAuth(row: Record<string, unknown> | null | undefined) {
  if (!row) return row;
  return {
    ...row,
    smtpPass: row.smtpPass ? "" : null,
    twilioAuthToken: row.twilioAuthToken ? "" : null,
    squareAccessToken: row.squareAccessToken ? "" : null,
  };
}

export function buildSmtpConfig(settings: Record<string, unknown> | null | undefined): SmtpConfig | null {
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) return null;
  return {
    host: settings.smtpHost as string,
    port: (settings.smtpPort as number) ?? 587,
    secure: (settings.smtpSecure as boolean) ?? false,
    user: settings.smtpUser as string,
    pass: settings.smtpPass as string,
    from: (settings.smtpFrom as string) || (settings.smtpUser as string),
  };
}

export function buildSmsCreds(settings: Record<string, unknown> | null | undefined): SmsCreds | null {
  if (!settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioFromNumber) return null;
  return {
    accountSid: settings.twilioAccountSid as string,
    authToken: settings.twilioAuthToken as string,
    fromNumber: settings.twilioFromNumber as string,
  };
}

export function buildSquareConfig(settings: Record<string, unknown> | null | undefined): SquareCreds | null {
  if (!settings?.squareApplicationId || !settings?.squareLocationId || !settings?.squareAccessToken) return null;
  return {
    applicationId: settings.squareApplicationId as string,
    locationId: settings.squareLocationId as string,
    accessToken: settings.squareAccessToken as string,
    environment: (settings.squareEnvironment as "sandbox" | "production") || "sandbox",
  };
}
