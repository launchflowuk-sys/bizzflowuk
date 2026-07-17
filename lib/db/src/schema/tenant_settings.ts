import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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
  heroImageUrl: text("hero_image_url"),
  aboutText: text("about_text"),
  aboutImageUrl: text("about_image_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
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
  // Per-event, per-channel notification toggles
  notifyLeadNewEmail: boolean("notify_lead_new_email").default(true),
  notifyLeadNewSms: boolean("notify_lead_new_sms").default(true),
  notifySurveyBookedEmail: boolean("notify_survey_booked_email").default(true),
  notifySurveyBookedSms: boolean("notify_survey_booked_sms").default(true),
  notifyQuoteSentEmail: boolean("notify_quote_sent_email").default(true),
  notifyQuoteSentSms: boolean("notify_quote_sent_sms").default(true),
  notifyQuoteAcceptedEmail: boolean("notify_quote_accepted_email").default(false),
  notifyQuoteAcceptedSms: boolean("notify_quote_accepted_sms").default(false),
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
