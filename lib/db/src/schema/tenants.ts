import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantsTable = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry").notNull().default("rendering"),
  suspended: boolean("suspended").notNull().default(false),
  plan: text("plan").notNull().default("starter"),
  primaryColor: text("primary_color").notNull().default("#f97316"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  country: text("country").default("UK"),
  website: text("website"),
  description: text("description"),
  customDomain: text("custom_domain"),
  /**
   * Featured on the BizzFlowUK homepage, and in what order. NULL means not
   * featured — the default, so onboarding a tenant never puts them on a public
   * marketing page by accident.
   */
  showcaseOrder: integer("showcase_order"),
  /** The one line shown under their site in the showcase. */
  showcaseBlurb: text("showcase_blurb"),

  /**
   * BizzFlowUK's own subscription, on the PLATFORM Stripe account.
   * Not the tenant's Stripe keys in tenant_settings, which point the other way:
   * those take money from their customers, these take money from them.
   */
  billingCustomerId: text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"),
  /** Mirrors Stripe: trialing | active | past_due | canceled | ... */
  billingStatus: text("billing_status"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  /**
   * WHO collects the money (migration 0044).
   *
   * 'self_serve' is the default and the advertised product: Stripe Checkout at
   * the standard price. 'managed' means we invoice them outside the platform,
   * so the subscribe button must not appear and /billing/checkout refuses —
   * otherwise a customer already paying us by invoice gets charged a second
   * time by their own dashboard.
   */
  billingMode: text("billing_mode").notNull().default("self_serve"),
  /**
   * WHAT they pay, when it is not the standard price. Null means standard.
   *
   * Display only. It never drives a charge: the amount charged comes from the
   * Stripe price id, which is the single source of truth for money. Keeping
   * this advisory is deliberate — a number in our database that looked like it
   * set the price would eventually disagree with Stripe, and Stripe would win
   * silently.
   */
  billingPriceGbp: text("billing_price_gbp"),
  /** What a negotiated arrangement covers, in the owner's words. */
  billingNote: text("billing_note"),
  /** When their website actually went live, so the trial promise is auditable. */
  websiteDeliveredAt: timestamp("website_delivered_at", { withTimezone: true }),
  /** Per-tenant module switches. New modules stay dark until enabled (migration 0032). */
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
