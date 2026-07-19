import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const SLUG = "amo-services";
const BRAND_GREEN = "#7DB93F"; // sampled from the client's logo

/**
 * One-time bootstrap for the AMO Services tenant (construction industry, tenant #2).
 * Idempotent: keyed on the tenant slug — if the tenant row exists, nothing runs, so
 * dashboard edits made after first boot are never overwritten.
 *
 * The 7 services are the client's real categories from amoservices.co.uk — do not
 * add or rename without client approval. No invented stats anywhere ("Established
 * 2011" is the only age/number claim, from Companies House incorporation).
 */
/**
 * Ensures the AMO Services tenant-admin account exists. Runs on EVERY boot
 * (not just first tenant seed) so the account can still be created if the
 * password env var is added to Coolify after the tenant already seeded.
 * Never modifies an existing user — same safety rule as ensurePlatformUsers.
 * Password comes from AMO_ADMIN_PASSWORD (set once in Coolify); no credential
 * ships in source.
 */
async function ensureAmoServicesAdmin(tenantId: number): Promise<void> {
  const password = process.env["AMO_ADMIN_PASSWORD"];
  if (!password) {
    logger.warn("AMO_ADMIN_PASSWORD not set — skipping AMO Services admin bootstrap (existing users never modified regardless)");
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const inserted = await db
    .insert(usersTable)
    .values({
      email: "mark@amoservices.co.uk",
      firstName: "Mark",
      lastName: "",
      role: "TENANT_ADMIN" as const,
      tenantId,
      passwordHash: hash,
    })
    .onConflictDoNothing({ target: usersTable.email })
    .returning({ email: usersTable.email });
  if (inserted.length) logger.info({ email: inserted[0].email }, "AMO Services tenant admin bootstrapped (new account)");
}

export async function seedAmoServicesIfMissing(): Promise<void> {
  try {
    const existing = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, SLUG))
      .limit(1);
    if (existing.length) {
      await ensureAmoServicesAdmin(existing[0].id);
      return;
    }

    logger.info("Seeding AMO Services tenant (first boot with this code)");

    const [tenant] = await db.insert(tenantsTable).values({
      name: "AMO Services",
      slug: SLUG,
      industry: "construction",
      primaryColor: BRAND_GREEN,
      logoUrl: "/amo-services/amo-services-logo.webp",
      phone: "01375 506071",
      email: "info@amoservices.co.uk",
      city: "Grays",
      address: "Grays, Essex",
      country: "UK",
      website: "https://amoservices.co.uk",
      description:
        "Construction company established in 2011 — new builds, home renovations, loft conversions, kitchens, electrical services, bricklaying and commercial works across Essex and London.",
      customDomain: "amoservices.co.uk",
    }).returning({ id: tenantsTable.id });

    const tenantId = tenant.id;

    await db.insert(tenantSettingsTable).values({
      tenantId,
      logoUrl: "/amo-services/amo-services-logo.webp",
      primaryColor: BRAND_GREEN,
      secondaryColor: "#111111",
      heroHeadline: "Quality Construction, Built To Last",
      heroSubheadline:
        "From new builds and loft conversions to kitchens, electrical work and full home renovations — AMO Services has been building and improving properties since 2011.",
      heroImageUrl: "/amo-services/amo-services-hero-home.webp",
      aboutText:
        "AMO Services is a construction company established in 2011, covering Essex and London. We take on projects of every size — new builds, commercial works, home renovations, loft conversions, kitchen installations, electrical services and bricklaying — with one team responsible for the job from first visit to final handover.",
      aboutImageUrl: "/amo-services/amo-services-team-portrait-1600x1200.webp",
      phone: "01375 506071",
      email: "info@amoservices.co.uk",
      // Lead/contact alerts. shoji147@gmail.com is on the list for the testing
      // phase — remove it in Dashboard → Settings once Mark takes over.
      adminNotificationEmail: "mark@amoservices.co.uk, shoji147@gmail.com",
      address: "Grays, Essex",
      city: "Grays",
      seoTitle: "AMO Services — Construction Company in Grays, Essex | New Builds, Renovations & More",
      seoDescription:
        "AMO Services is a Grays-based construction company established in 2011. New builds, home renovations, loft conversions, kitchens, electrical services and bricklaying across Essex and London.",
      ctaText: "Get a Free Quote",
    });

    // The client's real 7 service categories (verbatim from amoservices.co.uk)
    const services = [
      {
        name: "New Builds", slug: "new-builds",
        tagline: "Complete new-build construction from groundworks to handover",
        description: "Full new-build projects managed end to end — foundations, structure, roofing, first and second fix, through to a finished, ready-to-occupy property.",
        heroImageUrl: "/amo-services/amo-services-new-builds-uk.webp",
      },
      {
        name: "Commercial", slug: "commercial",
        tagline: "Commercial construction and fit-out works",
        description: "Construction, refurbishment and fit-out works for commercial premises — delivered around your business with clear programmes and minimal disruption.",
        heroImageUrl: "/amo-services/amo-services-commercial-construction-uk.webp",
      },
      {
        name: "Home Renovations", slug: "home-renovations",
        tagline: "Full and partial home renovations, managed by one team",
        description: "Whole-house refurbishments, extensions and structural alterations — one team handling the trades, the schedule and the finish so the project stays on track.",
        heroImageUrl: "/amo-services/amo-services-home-renovations-uk.webp",
      },
      {
        name: "Loft Conversions", slug: "loft-conversions",
        tagline: "Turn unused loft space into a bedroom, office or bathroom",
        description: "Dormer, hip-to-gable and Velux loft conversions — structural work, staircases, insulation, electrics and plastering, all completed to building regulations.",
        heroImageUrl: "/amo-services/amo-services-loft-conversions-uk.webp",
      },
      {
        name: "Electrical Services", slug: "electrical-services",
        tagline: "Domestic and commercial electrical work, planned or urgent",
        description: "Rewires, consumer unit upgrades, new circuits, lighting and fault-finding — for both planned projects and urgent call-outs.",
        heroImageUrl: "/amo-services/amo-services-electrical-services-uk.webp",
      },
      {
        name: "Kitchens", slug: "kitchens",
        tagline: "Kitchen design, supply and full installation",
        description: "Complete kitchen installations — strip-out, first-fix alterations, fitting, worktops, tiling and finishing, coordinated as a single project.",
        heroImageUrl: "/amo-services/amo-services-kitchen-installation-uk.webp",
      },
      {
        name: "Bricklaying", slug: "bricklaying",
        tagline: "Brickwork for extensions, garden walls and structural work",
        description: "Skilled bricklaying for extensions, boundary and garden walls, repairs and structural work — clean lines, correct bonds and properly finished joints.",
        heroImageUrl: "/amo-services/amo-services-bricklaying-uk.webp",
      },
    ];
    await db.insert(servicesTable).values(
      services.map((s, i) => ({ tenantId, ...s, published: true, featured: true, sortOrder: (i + 1) * 10 })),
    );

    // Service areas — mirrors the business's Essex/London coverage; client can edit in the dashboard
    const areas = [
      { name: "Grays", slug: "grays", county: "Essex" },
      { name: "Thurrock", slug: "thurrock", county: "Essex" },
      { name: "Essex", slug: "essex", county: "Essex" },
      { name: "London", slug: "london", county: "Greater London" },
    ];
    await db.insert(areasTable).values(
      areas.map((a, i) => ({ tenantId, ...a, published: true, sortOrder: (i + 1) * 10 })),
    );

    await ensureAmoServicesAdmin(tenantId);

    logger.info({ tenantId }, "AMO Services tenant seeded (tenant, settings, 7 services, 4 areas)");
  } catch (err) {
    logger.error({ err }, "AMO Services seed failed — non-fatal, server will still start");
  }
}
