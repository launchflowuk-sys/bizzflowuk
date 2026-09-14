import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

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

/** From the approved brief — confirm against what the client actually offers before launch. */
const SERVICES: Array<{ name: string; slug: string; tagline: string; description: string }> = [
  { name: "Boiler Installation", slug: "boiler-installation", tagline: "A new boiler, fitted properly and explained plainly", description: "We size the boiler to your home rather than upselling, fit it tidily, and walk you through the controls before we leave." },
  { name: "Boiler Repair", slug: "boiler-repair", tagline: "No heating or hot water? We'll get it diagnosed", description: "Fault-finding on all major makes, with the common parts carried on the van so most repairs finish the same visit." },
  { name: "Boiler Servicing", slug: "boiler-servicing", tagline: "An annual service that keeps the warranty valid", description: "A full service and safety check, with a written record of what was tested and anything worth keeping an eye on." },
  { name: "Central Heating", slug: "central-heating", tagline: "Warm rooms, quiet pipes, sensible bills", description: "New systems, upgrades and repairs — including thermostats, valves and pipework that has never quite been right." },
  { name: "Bathrooms", slug: "bathrooms", tagline: "From first idea to final seal", description: "Full bathroom installation handled by one team, so there is one person to ask and one standard of finish." },
  { name: "Leaks & Blockages", slug: "leaks-blockages", tagline: "Found, fixed, and left dry", description: "Tracing leaks without pulling your house apart, and clearing blockages properly rather than shifting them along." },
  { name: "Gas Safety Certificates", slug: "gas-safety-certificates", tagline: "Landlord certificates, issued the same day", description: "A full landlord gas safety check, with the certificate sent to you electronically as soon as it is signed off." },
  { name: "Emergency Plumbing", slug: "emergency-plumbing", tagline: "When it can't wait until Monday", description: "Burst pipes, no heat, no hot water. Call and speak to someone who can actually come out." },
];

const AREAS: Array<{ name: string; slug: string }> = [
  { name: "Grays", slug: "grays" },
  { name: "Thurrock", slug: "thurrock" },
  { name: "Tilbury", slug: "tilbury" },
  { name: "Chafford Hundred", slug: "chafford-hundred" },
  { name: "South Ockendon", slug: "south-ockendon" },
  { name: "Corringham", slug: "corringham" },
  { name: "Stanford-le-Hope", slug: "stanford-le-hope" },
  { name: "Basildon", slug: "basildon" },
];

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
    email: "info@bpsplumbingandheating.com",
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
    email: "info@bpsplumbingandheating.com",
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
    SERVICES.map((s, i) => ({ tenantId: tenant.id, ...s, published: true, sortOrder: i + 1 })),
  );

  await db.insert(areasTable).values(
    AREAS.map((a, i) => ({ tenantId: tenant.id, ...a, county: "Essex", published: true, sortOrder: i + 1 })),
  );

  logger.info("BPS Plumbing & Heating tenant seeded — no reviews seeded by design; confirm trust claims before promotion");
}
