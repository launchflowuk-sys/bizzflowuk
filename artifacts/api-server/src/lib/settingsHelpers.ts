import type { SmtpConfig } from "./email";
import type { SmsCreds } from "./sms";
import type { SquareCreds } from "./square";
import { stripeKeysAgree, type StripeCreds } from "./stripe";
import type { BrandConfig } from "./emailShell";
import { signObjectAccessToken } from "./objectStorage";

const PLATFORM_BASE_URL = process.env.PUBLIC_BASE_URL || "https://bizzflowuk.com";

/**
 * Builds a fetchable URL for a private object-storage path (e.g. an uploaded lead photo),
 * honoring a tenant's custom domain if set. The stored path alone (e.g. "/objects/6/x.jpg")
 * isn't reachable on its own — the real route lives at /api/storage/objects/... and requires
 * either an in-app session or this signed token, so every place that links to an uploaded
 * file (an email, in particular) must go through this rather than use the raw path directly.
 */
export function buildObjectUrl(objectPath: string, customDomain?: string | null): string {
  const origin = customDomain ? `https://${customDomain}` : PLATFORM_BASE_URL;
  return `${origin}/api/storage${objectPath}?token=${signObjectAccessToken(objectPath)}`;
}

/**
 * Fields from tenantSettings that are safe to expose on the unauthenticated public site
 * endpoint. This is an ALLOWLIST — any new column added to the table will be hidden from
 * the public by default unless it is explicitly listed here.
 */
const PUBLIC_SETTINGS_ALLOWLIST = new Set([
  "id", "tenantId",
  "logoUrl", "faviconUrl",
  "primaryColor", "secondaryColor", "accentColor",
  "heroHeadline", "heroSubheadline", "heroImageUrl", "ctaText", "ctaUrl",
  "aboutText", "aboutImageUrl", "serviceAreaText", "footerText",
  "email", "phone", "address", "city", "description",
  "serviceBase", "serviceArea",
  "socialFacebook", "socialInstagram", "socialTwitter", "socialLinkedin",
  // The site-wide SEO pair. These were missing, so the CMS fields silently did nothing on every
  // tenant's home page and the hardcoded fallback always won.
  "seoTitle", "seoDescription",
  "googleAnalyticsId", "googleAdsConversionId", "googleAdsConversionLabel", "termsContent", "privacyContent",
  // Trust badges are public-facing copy a tenant writes about itself ("Gas Safe
  // registered", "Fully insured") and the plumbing template renders them in the
  // strip under the hero. Presentation only — nothing operational.
  "trustBadges", "whatsappNumber",
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
    // The secret key can move money and the webhook secret authenticates
    // Stripe's callbacks — neither ever leaves the server, not even to the
    // tenant's own settings page. The publishable key is NOT masked: it is
    // designed to be public and the browser needs it to render the card field.
    stripeSecretKey: row.stripeSecretKey ? "" : null,
    stripeWebhookSecret: row.stripeWebhookSecret ? "" : null,
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

/** Builds the branding used by the shared HTML email shell — settings override tenant defaults. */
export function buildBrandConfig(
  tenant: Record<string, unknown> | null | undefined,
  settings: Record<string, unknown> | null | undefined,
): BrandConfig {
  return {
    tenantName: (tenant?.name as string) || "",
    logoUrl: (settings?.logoUrl as string) || (tenant?.logoUrl as string) || null,
    primaryColor: (settings?.primaryColor as string) || (tenant?.primaryColor as string) || null,
    secondaryColor: (settings?.secondaryColor as string) || null,
    phone: (settings?.phone as string) || (tenant?.phone as string) || null,
    email: (settings?.email as string) || (tenant?.email as string) || null,
    address: (settings?.address as string) || (tenant?.address as string) || null,
    city: (settings?.city as string) || (tenant?.city as string) || null,
    websiteUrl: (tenant?.website as string) || null,
    facebookUrl: (settings?.facebookUrl as string) || null,
    instagramUrl: (settings?.instagramUrl as string) || null,
    twitterUrl: (settings?.twitterUrl as string) || null,
    youtubeUrl: (settings?.youtubeUrl as string) || null,
    tiktokUrl: (settings?.tiktokUrl as string) || null,
  };
}

/**
 * Stripe credentials, or null when the tenant cannot take a Stripe payment.
 *
 * Both halves must be present and must belong to the same environment. A live
 * publishable key paired with a test secret key is a configuration that only
 * fails at the till, in front of a customer, so it is refused here instead.
 */
export function buildStripeConfig(settings: Record<string, unknown> | null | undefined): StripeCreds | null {
  const publishableKey = settings?.stripePublishableKey as string | undefined;
  const secretKey = settings?.stripeSecretKey as string | undefined;
  if (!publishableKey || !secretKey) return null;
  if (!stripeKeysAgree(publishableKey, secretKey)) return null;
  return { publishableKey, secretKey };
}

/**
 * Which till this tenant is using.
 *
 * `paymentProvider` is the explicit choice. When it is unset — which is every
 * tenant that existed before Stripe was added — fall back to whichever set of
 * credentials is actually complete, so nobody has to visit a settings page to
 * keep working exactly as they did yesterday. Square is preferred in that
 * fallback because it is the one already taking real money.
 */
export function resolvePaymentProvider(
  settings: Record<string, unknown> | null | undefined,
): "square" | "stripe" | null {
  const chosen = settings?.paymentProvider as string | undefined;
  if (chosen === "stripe") return buildStripeConfig(settings) ? "stripe" : null;
  if (chosen === "square") return buildSquareConfig(settings) ? "square" : null;
  if (buildSquareConfig(settings)) return "square";
  if (buildStripeConfig(settings)) return "stripe";
  return null;
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
