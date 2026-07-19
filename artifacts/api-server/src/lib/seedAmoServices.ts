import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable, usersTable, userTenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const SLUG = "amo-services";
const BRAND_GREEN = "#7DB93F"; // sampled from the client's logo

interface ServiceSeed {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  content: string;
  benefits: string[];
  processSteps: Array<{ title: string; description: string }>;
  heroImageUrl: string;
}

// The client's real 7 service categories (verbatim names from amoservices.co.uk),
// with grounded professional copy — no invented stats, guarantees or accreditations.
const AMO_SERVICES: ServiceSeed[] = [
  {
    name: "New Builds", slug: "new-builds",
    tagline: "Complete new-build construction from groundworks to handover",
    description: "Full new-build projects managed end to end — foundations, structure, roofing, first and second fix, through to a finished, ready-to-occupy property.",
    content: "A new build is the biggest project most people ever commission, and it lives or dies on how well the trades are coordinated. AMO Services takes on new-build construction as a single, managed job — from setting out and groundworks through to the final coat of paint — so you have one team accountable for the whole property rather than a dozen separate contractors to chase.\n\nWe work from your architect's drawings and the approved planning and building-regulations details, keeping the structure, the services and the finishes moving in the right order. That means fewer delays, fewer surprises, and a build that stays true to the design you signed off.\n\nWhether it's a single home, a replacement dwelling or a small development, the process is the same: a clear programme, regular updates, and a property handed over finished, tested and ready to live in.",
    benefits: ["Groundworks, foundations and drainage", "Structural build, roofing and weathering", "First and second fix across all trades", "Built to your approved drawings and building regs", "One team accountable from start to handover"],
    processSteps: [
      { title: "Drawings & Programme", description: "We review your architect's plans and approved details and set out a clear build programme." },
      { title: "Groundworks & Structure", description: "Foundations, drainage and the structural shell are built and made weathertight." },
      { title: "First & Second Fix", description: "Electrics, plumbing, plastering, joinery and finishes are coordinated in the right order." },
      { title: "Snag & Handover", description: "Everything is tested, snagged and cleaned before the property is handed over to you." },
    ],
    heroImageUrl: "/amo-services/amo-services-new-builds-uk.webp",
  },
  {
    name: "Commercial", slug: "commercial",
    tagline: "Commercial construction and fit-out works",
    description: "Construction, refurbishment and fit-out works for commercial premises — delivered around your business with clear programmes and minimal disruption.",
    content: "Commercial work has a different pressure to domestic projects: every day the space isn't finished is a day it isn't earning. AMO Services plans commercial construction and fit-out around that reality — working to fixed programmes, out-of-hours where it helps, and in phases so parts of your premises can stay open while the rest is worked on.\n\nWe handle office refurbishments, retail and unit fit-outs, structural alterations and full commercial builds. The scope is agreed in writing up front, so you know exactly what's being delivered, to what standard, and by when.\n\nFrom a single-room refit to a whole-building refurbishment, the aim is the same — a professional finish, delivered on programme, with the disruption to your business kept to the minimum.",
    benefits: ["Office, retail and unit fit-outs", "Structural alterations and refurbishment", "Phased works to keep premises operating", "Fixed programmes and written scope", "Out-of-hours working where it reduces disruption"],
    processSteps: [
      { title: "Site Survey & Scope", description: "We assess the premises and agree a written scope, programme and phasing plan." },
      { title: "Strip-Out & Structure", description: "Existing fit-out is removed and any structural alterations are carried out safely." },
      { title: "Fit-Out & Services", description: "Partitions, electrics, finishes and fittings are installed to specification." },
      { title: "Completion & Handover", description: "The space is finished, tested and handed back ready to trade." },
    ],
    heroImageUrl: "/amo-services/amo-services-commercial-construction-uk.webp",
  },
  {
    name: "Home Renovations", slug: "home-renovations",
    tagline: "Full and partial home renovations, managed by one team",
    description: "Whole-house refurbishments, extensions and structural alterations — one team handling the trades, the schedule and the finish so the project stays on track.",
    content: "Renovating a home you're living in — or about to move into — is as much about managing disruption as it is about the building work. AMO Services runs renovations as one coordinated project: builders, electricians, plumbers, plasterers and decorators all working to the same programme, so you're not left project-managing a string of separate trades.\n\nWe take on everything from a single reconfigured room to a full refurbishment with structural changes, extensions and re-servicing. Where walls are coming down or layouts are changing, we handle the structural details and building-regulations side so the work is signed off correctly.\n\nYou get one point of contact, a clear schedule, and a home that's been brought up to the standard you pictured — finished properly, not left with the last ten percent undone.",
    benefits: ["Whole-house and single-room refurbishment", "Structural alterations and knock-throughs", "Re-wiring, re-plumbing and re-plastering", "Extensions tied into the existing property", "One managed schedule across every trade"],
    processSteps: [
      { title: "Walkthrough & Plan", description: "We walk the property with you, agree the scope and set a realistic schedule." },
      { title: "Strip-Out & Structure", description: "Removals, structural changes and any extension shell are completed first." },
      { title: "Services & Finishes", description: "Electrics, plumbing, plastering and decoration are brought together room by room." },
      { title: "Final Snag & Clean", description: "We snag, finish and clean so the home is ready to move straight into." },
    ],
    heroImageUrl: "/amo-services/amo-services-home-renovations-uk.webp",
  },
  {
    name: "Loft Conversions", slug: "loft-conversions",
    tagline: "Turn unused loft space into a bedroom, office or bathroom",
    description: "Dormer, hip-to-gable and Velux loft conversions — structural work, staircases, insulation, electrics and plastering, all completed to building regulations.",
    content: "A loft conversion is one of the most cost-effective ways to add a proper room to a house — an extra bedroom, a home office, or a bedroom with an en-suite — without giving up any garden or footprint. AMO Services takes on the whole conversion, from the structural steelwork and floor right through to the finished, decorated room.\n\nWe handle dormer, hip-to-gable and Velux (rooflight) conversions, matching the approach to your roof type and what you want from the space. That includes the staircase, insulation, electrics, plumbing for an en-suite, and the plastering and decoration — all completed to building regulations and signed off.\n\nBecause it's managed as one job, the messy structural work and the fine finishing are sequenced properly, and you're left with a room that feels like it was always part of the house.",
    benefits: ["Dormer, hip-to-gable and Velux conversions", "Structural steels, floor and staircase", "Insulation to building-regs standard", "En-suite plumbing and full electrics", "Plastered, decorated and ready to use"],
    processSteps: [
      { title: "Design & Feasibility", description: "We assess your roof, confirm what's achievable and agree the layout and finish." },
      { title: "Structure & Access", description: "Steels, floor joists and the new staircase are installed to open up the space." },
      { title: "Insulate & Service", description: "Insulation, electrics and any en-suite plumbing are fitted to regulations." },
      { title: "Finish & Sign-Off", description: "Plastering, decoration and building-control sign-off complete the room." },
    ],
    heroImageUrl: "/amo-services/amo-services-loft-conversions-uk.webp",
  },
  {
    name: "Electrical Services", slug: "electrical-services",
    tagline: "Domestic and commercial electrical work, planned or urgent",
    description: "Rewires, consumer unit upgrades, new circuits, lighting and fault-finding — for both planned projects and urgent call-outs.",
    content: "Having electrical work in-house means AMO Services can wire its own builds and renovations properly — and take on standalone electrical jobs for customers who just need the electrics sorted. From a full rewire to a single new circuit, the work is carried out safely and to current wiring standards.\n\nWe cover consumer unit (fuse board) upgrades, rewires, additional sockets and circuits, indoor and outdoor lighting, and fault-finding when something isn't working as it should. Because we also build, electrical work on a renovation is coordinated with the rest of the job rather than bolted on at the end.\n\nWork is split between planned projects, booked in around you, and more urgent issues where something needs looking at quickly — tell us which it is on the quote form and we'll respond accordingly.",
    benefits: ["Full and partial rewires", "Consumer unit / fuse board upgrades", "New sockets, circuits and lighting", "Fault-finding and repairs", "Planned projects or urgent call-outs"],
    processSteps: [
      { title: "Assess & Quote", description: "We establish what's needed — planned upgrade or urgent fault — and quote clearly." },
      { title: "Isolate & Prepare", description: "Circuits are safely isolated and the work area prepared before any work begins." },
      { title: "Install & Wire", description: "New wiring, boards, circuits or fittings are installed to current standards." },
      { title: "Test & Certify", description: "Everything is tested, and the relevant certification is provided on completion." },
    ],
    heroImageUrl: "/amo-services/amo-services-electrical-services-uk.webp",
  },
  {
    name: "Kitchens", slug: "kitchens",
    tagline: "Kitchen design, supply and full installation",
    description: "Complete kitchen installations — strip-out, first-fix alterations, fitting, worktops, tiling and finishing, coordinated as a single project.",
    content: "A new kitchen touches almost every trade — joinery, electrics, plumbing, gas, tiling, plastering and decorating — which is exactly why it's worth having one team run the whole thing. AMO Services takes a kitchen from the old units coming out to the new one fully fitted, working and finished.\n\nWe handle the strip-out, any first-fix moves to plumbing and electrics for a new layout, the fitting of units and worktops, and the tiling, splashbacks and decoration that finish it off. If you're changing the layout — moving the sink, adding an island, knocking through — that's coordinated as part of the same job.\n\nThe result is a kitchen installed properly and finished to a high standard, without you having to line up and manage separate fitters, electricians and plumbers yourself.",
    benefits: ["Strip-out of the existing kitchen", "First-fix plumbing and electrical changes", "Unit, worktop and appliance installation", "Tiling, splashbacks and finishing", "Layout changes handled as one project"],
    processSteps: [
      { title: "Design & Measure", description: "We confirm the layout, measure up and agree the specification and finishes." },
      { title: "Strip-Out & First Fix", description: "The old kitchen is removed and plumbing/electrics adjusted for the new layout." },
      { title: "Fit Units & Worktops", description: "Units, worktops and appliances are installed and levelled precisely." },
      { title: "Tile & Finish", description: "Tiling, splashbacks and decoration complete the room, ready to use." },
    ],
    heroImageUrl: "/amo-services/amo-services-kitchen-installation-uk.webp",
  },
  {
    name: "Bricklaying", slug: "bricklaying",
    tagline: "Brickwork for extensions, garden walls and structural work",
    description: "Skilled bricklaying for extensions, boundary and garden walls, repairs and structural work — clean lines, correct bonds and properly finished joints.",
    content: "Good brickwork is the difference between a wall that looks right for decades and one that's an eyesore from day one. AMO Services provides skilled bricklaying for everything from garden and boundary walls to the structural brickwork of extensions and new builds.\n\nWe work to the correct bonds and coursing, keep lines true and joints consistent, and match existing brick and mortar on repairs and extensions so new work blends with old. That covers piers, garden and retaining walls, extension skins, and structural brickwork built to the engineer's details where required.\n\nWhether it's a standalone wall or the brickwork element of a larger project, the standard is the same — clean, level, properly pointed brickwork that's built to last.",
    benefits: ["Extension and new-build brickwork", "Garden, boundary and retaining walls", "Brick matching on repairs and extensions", "Correct bonds, coursing and pointing", "Structural brickwork to engineer's details"],
    processSteps: [
      { title: "Assess & Match", description: "We check the job, and match brick and mortar where the work meets existing walls." },
      { title: "Set Out & Foundation", description: "The work is set out accurately on a suitable, level foundation." },
      { title: "Lay & Course", description: "Brickwork is laid to the correct bond, kept level and true throughout." },
      { title: "Point & Finish", description: "Joints are pointed and finished cleanly for a lasting, tidy result." },
    ],
    heroImageUrl: "/amo-services/amo-services-bricklaying-uk.webp",
  },
];

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
 * Consolidates Mark onto a single login (mark@amorendering.co.uk) that can access BOTH his
 * businesses via the dashboard business switcher. Runs every boot, idempotent, safe:
 *  - ensures mark@amorendering.co.uk exists (created with AMO_ADMIN_PASSWORD only if missing;
 *    an existing account's password is never touched — same rule as ensurePlatformUsers)
 *  - grants it TENANT_ADMIN membership of both AMO Rendering and AMO Services
 *  - retires the now-redundant mark@amoservices.co.uk login (deleted only if it has no
 *    dependent data; otherwise left untouched and logged)
 * Requires both tenants to exist; otherwise it no-ops and tries again next boot.
 */
async function ensureMarkMultiTenant(): Promise<void> {
  const [rendering] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, "amo-rendering")).limit(1);
  const [services] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
  if (!rendering || !services) return;

  let [mark] = await db.select().from(usersTable).where(eq(usersTable.email, "mark@amorendering.co.uk")).limit(1);
  if (!mark) {
    const password = process.env["AMO_ADMIN_PASSWORD"];
    if (!password) { logger.warn("mark@amorendering.co.uk missing and AMO_ADMIN_PASSWORD unset — skipping Mark multi-tenant setup"); return; }
    const hash = await bcrypt.hash(password, 12);
    await db.insert(usersTable).values({ email: "mark@amorendering.co.uk", firstName: "Mark", lastName: "", role: "TENANT_ADMIN" as const, tenantId: rendering.id, passwordHash: hash }).onConflictDoNothing({ target: usersTable.email });
    [mark] = await db.select().from(usersTable).where(eq(usersTable.email, "mark@amorendering.co.uk")).limit(1);
    if (mark) logger.info("mark@amorendering.co.uk created as Mark's unified login");
  }
  if (!mark) return;

  await db.insert(userTenantsTable).values([
    { userId: mark.id, tenantId: rendering.id, role: "TENANT_ADMIN" as const },
    { userId: mark.id, tenantId: services.id, role: "TENANT_ADMIN" as const },
  ]).onConflictDoNothing();

  // Default his active business to rendering, unless he's already on one of the two.
  if (mark.tenantId !== rendering.id && mark.tenantId !== services.id) {
    await db.update(usersTable).set({ tenantId: rendering.id }).where(eq(usersTable.id, mark.id));
  }

  // Retire the redundant services-only login. Delete only if it has no dependent data.
  const [old] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, "mark@amoservices.co.uk")).limit(1);
  if (old && old.id !== mark.id) {
    try {
      await db.delete(userTenantsTable).where(eq(userTenantsTable.userId, old.id));
      await db.delete(usersTable).where(eq(usersTable.id, old.id));
      logger.info("Retired redundant mark@amoservices.co.uk login (Mark now uses mark@amorendering.co.uk for both businesses)");
    } catch (e) {
      logger.warn({ err: e }, "Could not delete mark@amoservices.co.uk (has dependent data) — left in place");
    }
  }
}

/**
 * Backfills the rich service copy (content, benefits, process steps) onto the AMO Services
 * tenant's service rows. Runs every boot so tenants seeded by an earlier, thinner version of
 * this file get the fuller content — but only fills a row whose `content` is still empty, so a
 * later dashboard edit is never overwritten. Matched by slug.
 */
async function ensureAmoServicesContent(tenantId: number): Promise<void> {
  const rows = await db
    .select({ id: servicesTable.id, slug: servicesTable.slug, content: servicesTable.content })
    .from(servicesTable)
    .where(eq(servicesTable.tenantId, tenantId));
  const bySlug = new Map(rows.map(r => [r.slug, r]));
  let filled = 0;
  for (const s of AMO_SERVICES) {
    const row = bySlug.get(s.slug);
    if (!row || (row.content && row.content.trim().length > 0)) continue; // never clobber edits
    await db
      .update(servicesTable)
      .set({ content: s.content, benefits: s.benefits, processSteps: s.processSteps, tagline: s.tagline, description: s.description })
      .where(eq(servicesTable.id, row.id));
    filled++;
  }
  if (filled) logger.info({ tenantId, filled }, "AMO Services service content backfilled");
}

export async function seedAmoServicesIfMissing(): Promise<void> {
  try {
    const existing = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, SLUG))
      .limit(1);
    if (existing.length) {
      await ensureMarkMultiTenant();
      await ensureAmoServicesContent(existing[0].id);
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

    await db.insert(servicesTable).values(
      AMO_SERVICES.map((s, i) => ({ tenantId, ...s, published: true, featured: true, sortOrder: (i + 1) * 10 })),
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

    await ensureMarkMultiTenant();

    logger.info({ tenantId }, "AMO Services tenant seeded (tenant, settings, 7 services, 4 areas)");
  } catch (err) {
    logger.error({ err }, "AMO Services seed failed — non-fatal, server will still start");
  }
}
