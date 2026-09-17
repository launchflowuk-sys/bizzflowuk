import { pgTable, text, serial, timestamp, integer, boolean, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const tenantSettingsTable = pgTable("tenant_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id).unique(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#f97316"),
  secondaryColor: text("secondary_color").default("#1e293b"),
  heroHeadline: text("hero_headline"),
  heroSubheadline: text("hero_subheadline"),
  /**
   * The badge on the hero photograph, e.g. "10-year warranty".
   *
   * A claim, so it is the tenant's to make: the guarantee depends on the boiler
   * fitted and on the installer's accreditation. Empty means no badge, because
   * a shared template inventing one would be putting words in an engineer's
   * mouth about a commitment he has to honour.
   */
  heroBadge: text("hero_badge"),

  /**
   * Gas Safe registration, for the badge on a heating site.
   *
   * The number is the claim; the URL is where a visitor goes to check it. They
   * are separate because the register's deep-link format could not be verified
   * -- gassaferegister.co.uk refuses automated requests -- so the business
   * pastes the link they can see in their own browser rather than us guessing a
   * path and shipping a trust badge that 404s.
   *
   * Empty means no badge: a template must never assert that a business is Gas
   * Safe registered.
   */
  gasSafeNumber: text("gas_safe_number"),
  gasSafeUrl: text("gas_safe_url"),
  heroImageUrl: text("hero_image_url"),
  aboutText: text("about_text"),
  aboutImageUrl: text("about_image_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  // Marketing location, separate from the postal address above. serviceBase is where they trade
  // FROM ("Grays, Thurrock"); serviceArea is the region they SELL INTO ("Essex & London"). The
  // public templates read these instead of hardcoding one tenant's patch into shared copy.
  serviceBase: text("service_base"),
  serviceArea: text("service_area"),
  googleMapsUrl: text("google_maps_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  youtubeUrl: text("youtube_url"),
  tiktokUrl: text("tiktok_url"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  googleAnalyticsId: text("google_analytics_id"),
  googleAdsConversionId: text("google_ads_conversion_id"),
  googleAdsConversionLabel: text("google_ads_conversion_label"),
  termsContent: text("terms_content"),
  privacyContent: text("privacy_content"),
  ctaText: text("cta_text").default("Get a Free Quote"),
  showReviews: boolean("show_reviews").default(true),
  showGallery: boolean("show_gallery").default(true),
  showBlog: boolean("show_blog").default(true),
  showBeforeAfter: boolean("show_before_after").default(true),
  trustBadges: jsonb("trust_badges").$type<string[]>().default([]),
  adminNotificationEmail: text("admin_notification_email"),
  customerEmail: text("customer_email"),
  // SMTP settings (per-tenant, used by Nodemailer)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpSecure: boolean("smtp_secure").default(false),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFrom: text("smtp_from"),
  // Twilio SMS settings (per-tenant)
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  twilioFromNumber: text("twilio_from_number"),
  adminNotificationPhone: text("admin_notification_phone"),
  // Square payment settings (per-tenant)
  squareApplicationId: text("square_application_id"),
  squareLocationId: text("square_location_id"),
  squareAccessToken: text("square_access_token"),
  squareEnvironment: text("square_environment").default("sandbox"), // 'sandbox' | 'production'

  // Stripe payment settings (per-tenant). Keys carry their own environment
  // (pk_test/sk_test vs pk_live/sk_live), so unlike Square there is no separate
  // environment column that can drift out of step with the credentials.
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKey: text("stripe_secret_key"),
  stripeWebhookSecret: text("stripe_webhook_secret"),
  /** 'square' | 'stripe' | null — null means auto-detect from whichever credentials are complete. */
  paymentProvider: text("payment_provider"),

  /**
   * Google Business reviews, pulled onto the tenant's own site.
   * Place Details returns at most FIVE reviews, chosen by Google — that is
   * their limit. The rating and count below are for the whole place.
   */
  googlePlaceId: text("google_place_id"),
  googleRating: numeric("google_rating", { precision: 2, scale: 1 }),
  googleReviewCount: integer("google_review_count"),
  googleReviewsSyncedAt: timestamp("google_reviews_synced_at", { withTimezone: true }),
  // Customer-facing prefix for quote references, e.g. "AMO-R" -> AMO-R-0007. Null falls back to
  // "QUO". Per-tenant because the reference appears on the quote the customer receives (0019).
  quoteRefPrefix: text("quote_ref_prefix"),

  // Tax. Off by default — an invoice never shows VAT for a business that has
  // not told us it is registered (migration 0032).
  vatRegistered: boolean("vat_registered").notNull().default(false),
  vatNumber: text("vat_number"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("20"),
  cisRegistered: boolean("cis_registered").notNull().default(false),
  cisUtr: text("cis_utr"),
  cisRate: numeric("cis_rate", { precision: 5, scale: 2 }).default("20"),
  invoiceTerms: text("invoice_terms"),
  /**
   * When a job is completed, send the invoice that was waiting for it
   * (migration 0058). Off leaves it as a draft for the business to send.
   */
  autoSendInvoiceOnCompletion: boolean("auto_send_invoice_on_completion").notNull().default(true),
  paymentDays: integer("payment_days").notNull().default(14),

  /**
   * How to actually pay the invoice (migration 0046).
   *
   * Every invoice this platform sent before now told the customer what they
   * owed and nothing about where to send it. For a trade paid by bank transfer
   * that is the most important block on the page.
   */
  bankAccountName: text("bank_account_name"),
  bankName: text("bank_name"),
  bankSortCode: text("bank_sort_code"),
  bankAccountNumber: text("bank_account_number"),
  /** Anything else: "reference the invoice number", "we take card on the day". */
  paymentInstructions: text("payment_instructions"),

  /** Separate from `phone`, because a landline cannot receive WhatsApp (0037). */
  whatsappNumber: text("whatsapp_number"),
  // Per-event, per-channel notification toggles
  notifyLeadNewEmail: boolean("notify_lead_new_email").default(true),
  notifyLeadNewSms: boolean("notify_lead_new_sms").default(true),
  notifySurveyBookedEmail: boolean("notify_survey_booked_email").default(true),
  notifySurveyBookedSms: boolean("notify_survey_booked_sms").default(true),
  notifyQuoteSentEmail: boolean("notify_quote_sent_email").default(true),
  notifyQuoteSentSms: boolean("notify_quote_sent_sms").default(true),
  // Defaulted false by oversight while every sibling defaulted true, so tenants were never told
  // about the single most valuable event in the funnel — a customer accepting a quote (0018).
  notifyQuoteAcceptedEmail: boolean("notify_quote_accepted_email").default(true),
  notifyQuoteAcceptedSms: boolean("notify_quote_accepted_sms").default(true),
  notifyPaymentReceivedEmail: boolean("notify_payment_received_email").default(true),
  notifyPaymentReceivedSms: boolean("notify_payment_received_sms").default(true),
  notifyLeadWonEmail: boolean("notify_lead_won_email").default(true),
  notifyLeadWonSms: boolean("notify_lead_won_sms").default(true),
  notifyProjectInProgressEmail: boolean("notify_project_in_progress_email").default(true),
  notifyProjectInProgressSms: boolean("notify_project_in_progress_sms").default(true),
  notifyProjectCompleteEmail: boolean("notify_project_complete_email").default(true),
  notifyProjectCompleteSms: boolean("notify_project_complete_sms").default(true),
  // Review request automation
  reviewRequestEnabled: boolean("review_request_enabled").default(true),
  reviewRequestDelayHours: integer("review_request_delay_hours").default(24),
  reviewRequestChannel: text("review_request_channel").default("both"),
  reviewRequestTemplate: text("review_request_template"),
  reviewPlatformUrl: text("review_platform_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSettingsSchema = createInsertSchema(tenantSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenantSettings = z.infer<typeof insertTenantSettingsSchema>;
export type TenantSettings = typeof tenantSettingsTable.$inferSelect;
