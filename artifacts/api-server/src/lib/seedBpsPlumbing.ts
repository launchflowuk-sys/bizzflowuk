import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { BPS_SERVICES, BPS_AREAS } from "./bpsContent";

/**
 * One-time bootstrap for BPS Plumbing & Heating (plumbing industry, tenant #4).
 * Idempotent: keyed on the tenant slug — if the row exists nothing runs, so dashboard
 * edits are never overwritten.
 *
 * ⚠ READ BEFORE PUBLIC LAUNCH.
 *  - Contact details and service copy come from the approved build brief, which was written
 *    from the client's own existing website. They are his claims, not ours — but the brief
 *    itself flags that the registration and insurance statements in `trustBadges` must be
 *    confirmed with him before the site is promoted publicly.
 *  - NO REVIEWS ARE SEEDED. The business has real customers but we have not collected
 *    verified quotes, and inventing them would put false AggregateRating schema on a live
 *    site. The reviews section renders nothing until genuine ones are added.
 *  - No stats, no "established" year, no star ratings.
 *
 * Areas are real Thurrock / south Essex towns, so those are safe.
 */

const SLUG = "bps";
const BRAND_BLUE = "#0892CF";   // from the original logo



export async function seedBpsPlumbingIfMissing(): Promise<void> {
  const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
  if (existing.length) return;

  logger.info("Seeding BPS Plumbing & Heating tenant (first boot with this code)");

  const [tenant] = await db.insert(tenantsTable).values({
    name: "BPS Plumbing & Heating",
    slug: SLUG,
    industry: "plumbing",
    plan: "pro",
    primaryColor: BRAND_BLUE,
    phone: "07866 149 276",
    email: "brandon@bpsplumbingandheating.com",
    city: "Grays",
    country: "GB",
    description: "Plumbing and heating engineers covering Grays, Thurrock and south Essex.",
    customDomain: "bps.launchflow.co.uk",
  }).returning();

  await db.insert(tenantSettingsTable).values({
    tenantId: tenant.id,
    logoUrl: "/bps-logo.svg",
    primaryColor: BRAND_BLUE,
    heroImageUrl: "/bps-team-van-hero.webp",
    aboutText: "Local plumbing and heating engineers working across Grays, Thurrock and south Essex. Boilers, heating, bathrooms and emergencies — handled by the same two people from first call to final check.",
    phone: "07866 149 276",
    email: "brandon@bpsplumbingandheating.com",
    city: "Grays, Essex",
    seoTitle: "BPS Plumbing & Heating — Grays, Thurrock & Essex",
    seoDescription: "Boiler installation, repairs, servicing, central heating and bathrooms across Grays and Thurrock. Free quotes, emergency call-outs.",
    // The client's own claims, taken from his existing website. Confirm before promotion.
    trustBadges: ["Gas Safe registered", "24/7 emergency support", "Free, no-obligation quotes", "Fully insured workmanship"],
    serviceBase: "Grays",
    serviceArea: "Grays, Thurrock and south Essex",
    showReviews: true,
    showBlog: true,
  });

  await db.insert(servicesTable).values(
    BPS_SERVICES.map((s, i) => ({ tenantId: tenant.id, name: s.name, slug: s.slug, tagline: s.tagline, description: s.description, content: s.content, benefits: s.benefits, processSteps: s.processSteps ?? [], published: true, sortOrder: i + 1 })),
  );

  await db.insert(areasTable).values(
    BPS_AREAS.map((a, i) => ({ tenantId: tenant.id, name: a.name, slug: a.slug, county: a.county, description: a.description, content: a.content, published: true, sortOrder: i + 1 })),
  );

  logger.info("BPS Plumbing & Heating tenant seeded — no reviews seeded by design; confirm trust claims before promotion");
}
