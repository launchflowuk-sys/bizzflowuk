import type { SmtpConfig } from "./email";
import type { SmsCreds } from "./sms";

/**
 * Strip credentials that must never leave the server.
 * Applied to ALL settings-returning API responses, including public ones.
 */
export function maskSecrets(row: Record<string, unknown> | null | undefined) {
  if (!row) return row;
  const { smtpPass: _sp, twilioAuthToken: _tat, ...safe } = row;
  return safe;
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
